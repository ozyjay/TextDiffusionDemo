import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../server/app';

describe('Express API', () => {
  const app = createApp();
  const localModelProvider = process.platform === 'darwin' ? 'mlx-diffusiongemma' : 'hf-diffusiongemma';

  it('reports health with the fixed backend port', async () => {
    const response = await request(app).get('/api/health').expect(200);

    expect(response.body).toMatchObject({
      ok: true,
      service: 'text-diffusion-lab',
      port: 8300
    });
  });

  it('returns curated prompts and traces', async () => {
    const prompts = await request(app).get('/api/prompts').expect(200);
    const traces = await request(app).get('/api/traces').expect(200);

    expect(prompts.body.prompts).toHaveLength(4);
    expect(traces.body.traces.length).toBeGreaterThanOrEqual(4);
  });

  it('reports model provider diagnostics without secrets', async () => {
    const response = await request(createApp({
      modelAdapterUrl: 'http://secret-host.example:8600/private',
      modelTraceProvider: async () => null
    }))
      .get('/api/model-providers')
      .expect(200);

    expect(response.body.providerSelection).toBe('auto');
    const platformLocalProvider = process.platform === 'darwin' ? 'mlx-diffusiongemma' : 'hf-diffusiongemma';
    expect(response.body.providers.map((provider: { id: string }) => provider.id)).toEqual([
      'modeldeck',
      'external-adapter',
      'redhat-vllm',
      platformLocalProvider,
      'fallback'
    ]);
    expect(JSON.stringify(response.body)).not.toContain('secret-host');
  });

  it('reports the current model runtime status', async () => {
    const response = await request(app).get('/api/model-status').expect(200);

    expect(response.body.status).toMatchObject({
      state: 'fallback',
      preloadEnabled: false,
      progress: {
        percent: 0,
        label: expect.any(String)
      }
    });
    expect(response.body.status.message).toEqual(expect.any(String));
    expect(response.body.status.updatedAt).toEqual(expect.any(String));
  });

  it.each([
    ['ready', { ready: true, state: 'running' }, 'ready', 'is ready'],
    ['stopped', { ready: false, state: 'stopped' }, 'error', 'Start it from ModelDeck']
  ] as const)('reports ModelDeck route status when it is %s', async (_label, route, state, message) => {
    const urls: string[] = [];
    const response = await request(createApp({
      modelProvider: 'modeldeck',
      modelDeckModel: 'text-diffusion-lab-q4',
      fetchImpl: async (url) => {
        urls.push(String(url));
        return String(url).endsWith('/v1/health')
          ? new Response(JSON.stringify({ ok: true }), { status: 200 })
          : new Response(JSON.stringify({ data: [{ id: 'text-diffusion-lab-q4', ...route }] }), { status: 200 });
      }
    })).get('/api/model-status').expect(200);

    expect(response.body.status).toMatchObject({
      state,
      providerId: 'modeldeck',
      route: 'text-diffusion-lab-q4',
      preloadEnabled: false,
      message: expect.stringContaining(message)
    });
    expect(urls).toHaveLength(2);
    expect(urls.every((url) => !url.endsWith('/api/health'))).toBe(true);
  });

  it('reports safe fallback when the ModelDeck gateway is unavailable', async () => {
    const response = await request(createApp({
      modelProvider: 'modeldeck',
      modelDeckBaseUrl: 'http://private-modeldeck.example:8600',
      modelDeckModel: 'text-diffusion-lab-q4',
      fetchImpl: async () => {
        throw new Error('connect ECONNREFUSED private-modeldeck.example:8600');
      }
    })).get('/api/model-status').expect(200);

    expect(response.body.status).toMatchObject({
      state: 'error',
      providerId: 'modeldeck',
      preloadEnabled: false,
      message: 'ModelDeck gateway is unavailable. Check ModelDeck; scripted fallback remains available.'
    });
    expect(JSON.stringify(response.body)).not.toContain('private-modeldeck');
    expect(JSON.stringify(response.body)).not.toContain('ECONNREFUSED');
  });

  it('does not let MODEL_PRELOAD=0 force a ready ModelDeck route into fallback status', async () => {
    const previousPreload = process.env.MODEL_PRELOAD;
    process.env.MODEL_PRELOAD = '0';
    try {
      const response = await request(createApp({
        modelProvider: 'modeldeck',
        modelDeckModel: 'text-diffusion-lab-q4',
        fetchImpl: async (url) => String(url).endsWith('/v1/health')
          ? new Response(JSON.stringify({ ok: true }), { status: 200 })
          : new Response(JSON.stringify({
              data: [{ id: 'text-diffusion-lab-q4', ready: true, state: 'running' }]
            }), { status: 200 })
      })).get('/api/model-status').expect(200);

      expect(response.body.status).toMatchObject({
        state: 'ready',
        providerId: 'modeldeck',
        preloadEnabled: false
      });
    } finally {
      if (previousPreload === undefined) {
        delete process.env.MODEL_PRELOAD;
      } else {
        process.env.MODEL_PRELOAD = previousPreload;
      }
    }
  });

  it('returns ordered refinement stages for curated controls', async () => {
    const response = await request(app)
      .post('/api/refine')
      .send({
        outputType: 'story',
        promptId: 'robot-orientation-story',
        style: 'clear',
        creativity: 'balanced',
        length: 'medium',
        constraint: 'include-robot',
        steps: 5
      })
      .expect(200);

    expect(response.body.trace.stages.map((stage: { label: string }) => stage.label)).toEqual([
      'Noise',
      'Rough',
      'Clear',
      'Styled',
      'Final'
    ]);
  });

  it('streams refinement frames as server-sent events', async () => {
    const response = await request(app)
      .post('/api/refine/stream')
      .send({
        outputType: 'story',
        promptId: 'robot-orientation-story',
        style: 'clear',
        creativity: 'balanced',
        length: 'medium',
        constraint: 'include-robot',
        steps: 5,
        streamDelayMs: 0
      })
      .expect(200)
      .expect('Content-Type', /text\/event-stream/);

    expect(response.text).toContain('event: frame');
    expect(response.text).toContain('"index":0');
    expect(response.text).toContain('"label":"Noise"');
    expect(response.text).toContain('event: done');
    expect(response.text).toContain('"mode":"scripted"');
  });

  it('keeps story and Python prompt lanes separate', async () => {
    const response = await request(app)
      .post('/api/refine')
      .send({
        outputType: 'python',
        promptId: 'reef-temperature-python',
        style: 'clear',
        creativity: 'balanced',
        length: 'medium',
        constraint: 'none',
        steps: 5
      })
      .expect(200);

    expect(response.body.trace.outputType).toBe('python');
    expect(response.body.trace.stages.at(-1).text).toContain('temperatures');
  });

  it('falls back to scripted output when model-assisted mode has no adapter', async () => {
    const response = await request(createApp({
      modelProvider: localModelProvider,
      modelTraceProvider: async () => null
    }))
      .post('/api/refine')
      .send({
        outputType: 'story',
        promptId: 'robot-orientation-story',
        style: 'clear',
        creativity: 'balanced',
        length: 'medium',
        constraint: 'include-robot',
        steps: 5,
        mode: 'model-assisted'
      })
      .expect(200);

    expect(response.body.mode).toBe('model-fallback');
    expect(response.body.trace.id).toBe('robot-orientation-story-clear');
  });

  it('uses backend-managed model worker traces when no external adapter URL is configured', async () => {
    let requestedSteps = 0;
    const response = await request(createApp({
      modelProvider: localModelProvider,
      modelTraceProvider: async (modelRequest, seedTrace) => {
        requestedSteps = modelRequest.steps;
        return {
          ...seedTrace,
          id: 'robot-orientation-story-diffusiongemma',
          stages: [
            { label: 'Mask 0/8', text: '[Mask] [Mask]', note: 'Model draft frame.' },
            { label: 'Denoise 2/8', text: 'The robot [Mask]', note: 'Model draft frame.' },
            { label: 'Final', text: 'The robot waved at orientation.', note: 'Model final.' }
          ]
        };
      }
    }))
      .post('/api/refine')
      .send({
        outputType: 'story',
        promptId: 'robot-orientation-story',
        style: 'funny',
        creativity: 'balanced',
        length: 'short',
        constraint: 'include-robot',
        steps: 7,
        mode: 'model-assisted'
      })
      .expect(200);

    expect(requestedSteps).toBe(7);
    expect(response.body.mode).toBe('model-assisted');
    expect(response.body.trace.controls.steps).toBe(7);
    expect(response.body.trace.stages.map((stage: { label: string }) => stage.label)).toEqual([
      'Mask 0/8',
      'Denoise 2/8',
      'Final'
    ]);
  });

  it('passes a valid custom story prompt to the model provider through the seed trace', async () => {
    let providerPrompt = '';
    const customPrompt = 'A robot discovers the quietest study corner on campus.';

    const response = await request(createApp({
      modelProvider: localModelProvider,
      modelTraceProvider: async (_modelRequest, seedTrace) => {
        providerPrompt = seedTrace.prompt;
        return {
          ...seedTrace,
          id: 'robot-orientation-story-diffusiongemma',
          stages: [
            { label: 'Mask 0/8', text: '[Mask] [Mask]', note: 'Model draft frame.' },
            { label: 'Final', text: 'The robot found a quiet campus study nook.', note: 'Model final.' }
          ]
        };
      }
    }))
      .post('/api/refine')
      .send({
        outputType: 'story',
        promptId: 'robot-orientation-story',
        style: 'campus',
        creativity: 'balanced',
        length: 'short',
        constraint: 'include-robot',
        steps: 5,
        mode: 'model-assisted',
        customPrompt: `  ${customPrompt}  `
      })
      .expect(200);

    expect(providerPrompt).toBe(customPrompt);
    expect(response.body.mode).toBe('model-assisted');
    expect(response.body.trace.prompt).toBe(customPrompt);
  });

  it('keeps the visible custom prompt and hides unrelated scripted text on model fallback', async () => {
    const customPrompt = 'A tiny AI helps a lecturer find missing lab notes.';

    const response = await request(createApp({
      modelProvider: localModelProvider,
      modelTraceProvider: async () => null
    }))
      .post('/api/refine')
      .send({
        outputType: 'story',
        promptId: 'tiny-ai-practical-story',
        style: 'clear',
        creativity: 'balanced',
        length: 'medium',
        constraint: 'none',
        steps: 5,
        mode: 'model-assisted',
        customPrompt
      })
      .expect(200);

    expect(response.body.mode).toBe('model-fallback');
    expect(response.body.trace.prompt).toBe(customPrompt);
    expect(response.body.trace.stages).toEqual([
      expect.objectContaining({
        label: 'Not converged',
        text: expect.stringContaining('did not converge cleanly')
      })
    ]);
    expect(response.body.trace.metadata).toMatchObject({
      provider: 'fallback',
      safeFallback: true
    });
  });

  it('ignores custom prompts for the Python lane', async () => {
    let providerCalled = false;

    const response = await request(createApp({
      modelTraceProvider: async () => {
        providerCalled = true;
        return null;
      }
    }))
      .post('/api/refine')
      .send({
        outputType: 'python',
        promptId: 'number-guess-python',
        style: 'clear',
        creativity: 'balanced',
        length: 'short',
        constraint: 'none',
        steps: 5,
        mode: 'model-assisted',
        customPrompt: 'Please write about a secret visitor.'
      })
      .expect(200);

    expect(providerCalled).toBe(false);
    expect(response.body.trace.prompt).toBe('Write a small Python number guessing game.');
  });

  it('falls back when a configured adapter rejects the request', async () => {
    const response = await request(createApp({
      modelAdapterUrl: 'http://127.0.0.1:8600',
      fetchImpl: async () => new Response(JSON.stringify({ error: 'story output only' }), { status: 503 })
    }))
      .post('/api/refine')
      .send({
        outputType: 'python',
        promptId: 'number-guess-python',
        style: 'clear',
        creativity: 'balanced',
        length: 'medium',
        constraint: 'none',
        steps: 5,
        mode: 'model-assisted'
      })
      .expect(200);

    expect(response.body.mode).toBe('model-fallback');
    expect(response.body.trace.outputType).toBe('python');
  });

  it('uses the configured model adapter timeout before falling back', async () => {
    const seedResponse = await request(app)
      .post('/api/refine')
      .send({
        outputType: 'story',
        promptId: 'robot-orientation-story',
        style: 'clear',
        creativity: 'balanced',
        length: 'medium',
        constraint: 'include-robot',
        steps: 5
      });
    const modelTrace = {
      ...seedResponse.body.trace,
      id: 'robot-orientation-story-timeout-check',
      stages: seedResponse.body.trace.stages.map((stage: { label: string; text: string }) =>
        stage.label === 'Final' ? { ...stage, text: 'This should arrive too late.' } : stage
      )
    };

    const response = await request(createApp({
      modelAdapterUrl: 'http://127.0.0.1:8600',
      modelAdapterTimeoutMs: 1,
      modelTraceProvider: async () => null,
      fetchImpl: async (_url, init) => {
        await new Promise((resolve, reject) => {
          const signal = init?.signal as AbortSignal | undefined;
          const timer = setTimeout(resolve, 20);
          signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error('aborted'));
          });
        });
        return new Response(JSON.stringify({ trace: modelTrace }), { status: 200 });
      }
    }))
      .post('/api/refine')
      .send({
        outputType: 'story',
        promptId: 'robot-orientation-story',
        style: 'clear',
        creativity: 'balanced',
        length: 'medium',
        constraint: 'include-robot',
        steps: 5,
        mode: 'model-assisted'
      })
      .expect(200);

    expect(response.body.mode).toBe('model-fallback');
  });
});
