import { describe, expect, it } from 'vitest';
import { ModelDeckProvider } from '../../server/services/modelProviders/modelDeckProvider';
import { refineTrace } from '../../server/services/traceService';
import type { RefineRequest } from '../../shared/types';

const request: RefineRequest = {
  outputType: 'story',
  promptId: 'robot-orientation-story',
  style: 'clear',
  creativity: 'balanced',
  length: 'medium',
  constraint: 'include-robot',
  steps: 5,
  mode: 'model-assisted'
};

describe('ModelDeck provider', () => {
  it('checks gateway health and requires the configured model to be ready', async () => {
    const urls: string[] = [];
    const provider = new ModelDeckProvider({
      baseUrl: 'http://modeldeck.test:9600/',
      model: 'text-diffusion',
      fetchImpl: async (url) => {
        urls.push(String(url));
        return String(url).endsWith('/v1/health')
          ? json({ ok: true })
          : json({ models: [{ alias: 'text-diffusion', ready: true }] });
      }
    });

    await expect(provider.isAvailable()).resolves.toMatchObject({
      configured: true,
      available: true
    });
    expect(urls).toEqual([
      'http://modeldeck.test:9600/v1/health',
      'http://modeldeck.test:9600/v1/models'
    ]);
  });

  it('reports an unavailable or not-ready configured model', async () => {
    const missing = new ModelDeckProvider({
      model: 'wanted-model',
      fetchImpl: async (url) => String(url).endsWith('/health')
        ? json({ ok: true })
        : json({ data: [{ id: 'different-model', ready: true }] })
    });
    const notReady = new ModelDeckProvider({
      model: 'wanted-model',
      fetchImpl: async (url) => String(url).endsWith('/health')
        ? json({ ok: true })
        : json({ data: [{ id: 'wanted-model', ready: false }] })
    });

    await expect(missing.isAvailable()).resolves.toMatchObject({
      available: false,
      reason: expect.stringContaining('unavailable')
    });
    await expect(notReady.isAvailable()).resolves.toMatchObject({
      available: false,
      reason: expect.stringContaining('not ready')
    });
  });

  it('reports a stopped route with an actionable ModelDeck instruction', async () => {
    const provider = new ModelDeckProvider({
      model: 'text-diffusion-lab-q4',
      fetchImpl: async (url) => String(url).endsWith('/health')
        ? json({ ok: true })
        : json({ data: [{ id: 'text-diffusion-lab-q4', ready: false, state: 'stopped' }] })
    });

    await expect(provider.isAvailable()).resolves.toEqual({
      configured: true,
      available: false,
      reason: 'ModelDeck route "text-diffusion-lab-q4" is stopped. Start it from ModelDeck.'
    });
  });

  it('maps request fields, preserves explicit zero values, and propagates the seed', async () => {
    const mappedRequest: RefineRequest = {
      ...request,
      constraint: 'none',
      steps: 0,
      maxLength: 0,
      denoisingSteps: 0,
      blockLength: 0,
      temperature: 0,
      seed: 0
    };
    const seedTrace = refineTrace({ ...request, constraint: 'none', steps: 5 });
    seedTrace.prompt = 'Exact prompt for ModelDeck.';
    let body: Record<string, unknown> = {};
    const provider = new ModelDeckProvider({
      model: 'custom-diffusion-alias',
      fetchImpl: async (_url, init) => {
        body = JSON.parse(String(init?.body));
        return json({
          job_id: 'job-map',
          state: 'complete',
          text: 'Exact final.',
          seed: 0
        });
      }
    });

    const trace = await provider.refine(mappedRequest, seedTrace, 100);

    expect(body).toEqual({
      model: 'custom-diffusion-alias',
      prompt: expect.stringContaining('Exact prompt for ModelDeck.'),
      max_length: 0,
      denoising_steps: 0,
      block_length: 0,
      temperature: 0,
      seed: 0,
      stream_intermediate_frames: true
    });
    expect(String(body.prompt)).toContain('Return only the final answer in plain text.');
    expect(String(body.prompt)).toContain('No additional content constraint.');
    expect(trace?.metadata?.seed).toBe(0);
  });

  it('keeps the default block within the selected output length', async () => {
    let body: Record<string, unknown> = {};
    const provider = new ModelDeckProvider({
      fetchImpl: async (_url, init) => {
        body = JSON.parse(String(init?.body));
        return json({ job_id: 'short-job', state: 'complete', text: 'Pi is approximately 3.14159.' });
      }
    });

    await provider.refine(
      { ...request, length: 'short' },
      refineTrace({ ...request, length: 'short' }),
      100
    );

    expect(body.max_length).toBe(96);
    expect(body.block_length).toBe(96);
    expect(String(body.prompt)).toContain('at most 50 words and no list');
  });

  it('uses 48 denoising passes while sampling the requested number of visible stages', async () => {
    let body: Record<string, unknown> = {};
    const frames = Array.from({ length: 8 }, (_value, index) => ({
      step: index + 1,
      total_steps: 48,
      text: `Frame ${index + 1}.`
    }));
    const provider = new ModelDeckProvider({
      fetchImpl: async (_url, init) => {
        body = JSON.parse(String(init?.body));
        return json({
          job_id: 'sampled-job',
          state: 'complete',
          text: 'The exact terminal response.',
          frames
        });
      }
    });

    const trace = await provider.refine(
      { ...request, constraint: 'none', steps: 5 },
      refineTrace({ ...request, constraint: 'none', steps: 5 }),
      100
    );

    expect(body.denoising_steps).toBe(48);
    expect(trace?.stages.map((stage) => stage.text)).toEqual([
      'Frame 1.',
      'Frame 3.',
      'Frame 6.',
      'Frame 8.',
      'The exact terminal response.'
    ]);
    expect(trace?.metadata).toMatchObject({
      denoisingSteps: 48,
      returnedFrameCount: 8,
      displayedFrameCount: 4,
      retried: false
    });
  });

  it('keeps every unique intermediate frame when requested', async () => {
    const provider = new ModelDeckProvider({
      fetchImpl: async () => json({
        job_id: 'every-frame-job',
        state: 'complete',
        text: 'The exact terminal response.',
        frames: [
          { step: 1, total_steps: 48, text: 'First frame.' },
          { step: 24, total_steps: 48, text: 'Middle frame.' },
          { step: 47, total_steps: 48, text: 'Last draft frame.' }
        ]
      })
    });

    const trace = await provider.refine(
      { ...request, constraint: 'none', includeEveryFrame: true },
      refineTrace({ ...request, constraint: 'none' }),
      100
    );

    expect(trace?.stages.map((stage) => stage.text)).toEqual([
      'First frame.',
      'Middle frame.',
      'Last draft frame.',
      'The exact terminal response.'
    ]);
  });

  it('retries one corrupt terminal response with safer full-denoising settings', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    let requestCount = 0;
    const provider = new ModelDeckProvider({
      fetchImpl: async (_url, init) => {
        bodies.push(JSON.parse(String(init?.body)));
        requestCount += 1;
        return requestCount === 1
          ? json({ job_id: 'bad-job', state: 'complete', text: 'robot robot robot ???' })
          : json({ job_id: 'retry-job', state: 'complete', text: 'A robot arrived safely at orientation.' });
      }
    });

    const trace = await provider.refine(request, refineTrace(request), 100);

    expect(requestCount).toBe(2);
    expect(bodies[1]).toMatchObject({
      denoising_steps: 48,
      max_length: 96,
      temperature: 0.4,
      seed: 12
    });
    expect(trace?.stages.at(-1)?.text).toBe('A robot arrived safely at orientation.');
    expect(trace?.metadata?.retried).toBe(true);
  });

  it('rejects the trace when both terminal responses are corrupt', async () => {
    let requestCount = 0;
    const provider = new ModelDeckProvider({
      fetchImpl: async () => {
        requestCount += 1;
        return json({ job_id: `bad-job-${requestCount}`, state: 'complete', text: 'robot robot robot ???' });
      }
    });

    await expect(provider.refine(request, refineTrace(request), 100)).resolves.toBeNull();
    expect(requestCount).toBe(2);
    expect(provider.lastStatus().lastOutcome).toBe('invalid');
  });

  it('polls one request at a time and retains unique intermediate frames in arrival order', async () => {
    const noConstraintRequest = { ...request, constraint: 'none' };
    const seedTrace = refineTrace(noConstraintRequest);
    let pollCount = 0;
    let activePolls = 0;
    let maxActivePolls = 0;
    const provider = new ModelDeckProvider({
      pollIntervalMs: 1,
      fetchImpl: async (url) => {
        if (String(url).endsWith('/v1/diffuse')) {
          return json({
            job_id: 'job-frames',
            state: 'queued',
            frames: [{ step: 1, total_steps: 5, text: 'First frame.' }]
          });
        }
        activePolls += 1;
        maxActivePolls = Math.max(maxActivePolls, activePolls);
        pollCount += 1;
        await Promise.resolve();
        activePolls -= 1;
        return pollCount === 1
          ? json({
              job_id: 'job-frames',
              state: 'running',
              frames: [
                { step: 1, total_steps: 5, text: 'First frame.' },
                { step: 3, total_steps: 5, text: 'Third frame.' }
              ]
            })
          : json({
              job_id: 'job-frames',
              state: 'complete',
              text: '  Final text exactly as returned.  ',
              frames: [
                { step: 3, total_steps: 5, text: 'Third frame.' },
                { step: 4, total_steps: 5, text: 'Fourth frame.' }
              ],
              seed: 11,
              frame_count: 3,
              metrics: { total_seconds: 7.45 }
            });
      }
    });

    const trace = await provider.refine(noConstraintRequest, seedTrace, 200);

    expect(pollCount).toBe(2);
    expect(maxActivePolls).toBe(1);
    expect(trace?.stages.map((stage) => stage.text)).toEqual([
      'First frame.',
      'Third frame.',
      'Fourth frame.',
      '  Final text exactly as returned.  '
    ]);
    expect(trace?.stages.at(-1)?.rawText).toBe('  Final text exactly as returned.  ');
    expect(trace?.metadata).toMatchObject({ seed: 11, frameCount: 3, totalSeconds: 7.45 });
  });

  it.each([
    ['failed', { error: 'worker ran out of memory' }, 'worker ran out of memory'],
    ['cancelled', {}, 'cancelled']
  ] as const)('handles a %s job', async (state, extra, reason) => {
    const provider = new ModelDeckProvider({
      fetchImpl: async () => json({ job_id: 'terminal-job', state, ...extra })
    });

    await expect(provider.refine(request, refineTrace(request), 100)).resolves.toBeNull();
    expect(provider.lastStatus()).toMatchObject({
      lastOutcome: 'error',
      lastReason: expect.stringContaining(reason)
    });
  });

  it('surfaces HTTP detail and malformed response errors', async () => {
    const httpProvider = new ModelDeckProvider({
      fetchImpl: async () => json({ detail: 'alias is unavailable' }, 503)
    });
    const malformedProvider = new ModelDeckProvider({
      fetchImpl: async () => json({ state: 'queued' })
    });

    await expect(httpProvider.refine(request, refineTrace(request), 100)).resolves.toBeNull();
    expect(httpProvider.lastStatus().lastReason).toContain('HTTP 503: alias is unavailable');
    await expect(malformedProvider.refine(request, refineTrace(request), 100)).resolves.toBeNull();
    expect(malformedProvider.lastStatus().lastOutcome).toBe('invalid');
  });

  it('cancels an active ModelDeck job when the caller aborts', async () => {
    const controller = new AbortController();
    const calls: string[] = [];
    const provider = new ModelDeckProvider({
      pollIntervalMs: 20,
      fetchImpl: async (url) => {
        calls.push(String(url));
        if (String(url).endsWith('/cancel')) {
          return json({ job_id: 'abort-job', state: 'cancelled' });
        }
        controller.abort();
        return json({ job_id: 'abort-job', state: 'running' });
      }
    });

    await expect(provider.refine(request, refineTrace(request), 100, controller.signal)).resolves.toBeNull();

    expect(calls.at(-1)).toBe('http://127.0.0.1:8600/v1/jobs/abort-job/cancel');
    expect(provider.lastStatus().lastReason).toBe('ModelDeck request was cancelled.');
  });

  it('times out, cancels the active job, and reports an actionable timeout', async () => {
    const calls: string[] = [];
    const provider = new ModelDeckProvider({
      pollIntervalMs: 50,
      fetchImpl: async (url) => {
        calls.push(String(url));
        return json({ job_id: 'timeout-job', state: 'running' });
      }
    });

    await expect(provider.refine(request, refineTrace(request), 5)).resolves.toBeNull();

    expect(calls).toContain('http://127.0.0.1:8600/v1/jobs/timeout-job/cancel');
    expect(provider.lastStatus().lastReason).toContain('timed out after 5ms');
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
