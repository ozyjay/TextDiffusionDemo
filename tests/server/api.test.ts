import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../server/app';

describe('Express API', () => {
  const app = createApp();

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
    const response = await request(createApp({ modelTraceProvider: async () => null }))
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

  it('keeps the visible custom prompt on model fallback while using the curated scaffold', async () => {
    const customPrompt = 'A tiny AI helps a lecturer find missing lab notes.';

    const response = await request(createApp({ modelTraceProvider: async () => null }))
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
    expect(response.body.trace.stages.map((stage: { label: string }) => stage.label)).toEqual([
      'Noise',
      'Rough',
      'Clear',
      'Styled',
      'Final'
    ]);
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
