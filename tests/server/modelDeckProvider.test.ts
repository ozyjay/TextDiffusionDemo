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

  it('maps request fields, preserves explicit zero values, and propagates the seed', async () => {
    const mappedRequest: RefineRequest = {
      ...request,
      steps: 0,
      maxLength: 0,
      denoisingSteps: 0,
      blockLength: 0,
      temperature: 0,
      seed: 0
    };
    const seedTrace = refineTrace({ ...request, steps: 5 });
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
      prompt: 'Exact prompt for ModelDeck.',
      max_length: 0,
      denoising_steps: 0,
      block_length: 0,
      temperature: 0,
      seed: 0,
      stream_intermediate_frames: true
    });
    expect(trace?.metadata?.seed).toBe(0);
  });

  it('polls one request at a time and retains unique intermediate frames in arrival order', async () => {
    const seedTrace = refineTrace(request);
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

    const trace = await provider.refine(request, seedTrace, 200);

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
