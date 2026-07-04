import { describe, expect, it } from 'vitest';
import { getModelProviderDiagnostics, requestModelTrace } from '../../server/services/modelAdapter';
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

describe('model adapter', () => {
  it('returns a validated staged trace from a local adapter', async () => {
    const seedTrace = refineTrace(request);
    const modelTrace = {
      ...seedTrace,
      id: 'robot-orientation-story-model',
      stages: seedTrace.stages.map((stage) =>
        stage.label === 'Final'
          ? { ...stage, text: `${stage.text}\n\nModel-assisted polish.` }
          : stage
      )
    };

    const result = await requestModelTrace(request, seedTrace, {
      adapterUrl: 'http://127.0.0.1:8600',
      fetchImpl: async (url, init) => {
        if (String(url).endsWith('/api/health')) {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        expect(JSON.parse(String(init?.body)).seedTrace.id).toBe(seedTrace.id);
        return new Response(JSON.stringify({ trace: modelTrace }), { status: 200 });
      },
      timeoutMs: 50
    });

    expect(result?.id).toBe('robot-orientation-story-model');
    expect(result?.stages.at(-1)?.text).toContain('Model-assisted polish');
  });

  it('uses a backend-managed model trace provider when no adapter URL is configured', async () => {
    const seedTrace = refineTrace(request);
    const modelTrace = {
      ...seedTrace,
      id: 'robot-orientation-story-diffusiongemma',
      stages: [
        { label: 'Mask 0/8', text: '[Mask]', note: 'Model draft frame.' },
        { label: 'Final', text: 'The robot waved.', note: 'Model final.' }
      ]
    };

    const result = await requestModelTrace(request, seedTrace, {
      adapterUrl: '',
      fetchImpl: async () => new Response('{}'),
      modelTraceProvider: async () => modelTrace,
      timeoutMs: 50
    });

    expect(result?.id).toBe('robot-orientation-story-diffusiongemma');
    expect(result?.stages.map((stage) => stage.label)).toEqual(['Mask 0/8', 'Final']);
  });

  it('returns null when the adapter rejects an unsupported lane', async () => {
    const seedTrace = refineTrace(request);

    const result = await requestModelTrace(request, seedTrace, {
      adapterUrl: 'http://127.0.0.1:8600',
      fetchImpl: async (url) => String(url).endsWith('/api/health')
        ? new Response(JSON.stringify({ ok: true }), { status: 200 })
        : new Response(JSON.stringify({ error: 'story output only' }), { status: 503 }),
      timeoutMs: 50
    });

    expect(result).toBeNull();
  });

  it('returns null when adapter output does not match the requested lane', async () => {
    const seedTrace = refineTrace(request);
    const mismatchedTrace = {
      ...seedTrace,
      outputType: 'python'
    };

    const result = await requestModelTrace(request, seedTrace, {
      adapterUrl: 'http://127.0.0.1:8600',
      fetchImpl: async (url) => String(url).endsWith('/api/health')
        ? new Response(JSON.stringify({ ok: true }), { status: 200 })
        : new Response(JSON.stringify({ trace: mismatchedTrace }), { status: 200 }),
      timeoutMs: 50
    });

    expect(result).toBeNull();
  });

  it('honours explicit external adapter provider selection', async () => {
    const seedTrace = refineTrace(request);
    const modelTrace = { ...seedTrace, id: 'robot-orientation-story-external' };
    let externalCalls = 0;
    let workerCalls = 0;

    const result = await requestModelTrace(request, seedTrace, {
      adapterUrl: 'http://127.0.0.1:8600',
      providerSelection: 'external-adapter',
      fetchImpl: async (url) => {
        if (String(url).endsWith('/api/health')) {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        externalCalls += 1;
        return new Response(JSON.stringify({ trace: modelTrace }), { status: 200 });
      },
      modelTraceProvider: async () => {
        workerCalls += 1;
        return null;
      },
      timeoutMs: 50
    });

    expect(result?.id).toBe('robot-orientation-story-external');
    expect(externalCalls).toBe(1);
    expect(workerCalls).toBe(0);
  });

  it('honours explicit MLX provider selection without calling the external adapter', async () => {
    const seedTrace = refineTrace(request);
    const modelTrace = { ...seedTrace, id: 'robot-orientation-story-mlx' };
    let externalCalls = 0;

    const result = await requestModelTrace(request, seedTrace, {
      adapterUrl: 'http://127.0.0.1:8600',
      providerSelection: 'mlx-diffusiongemma',
      fetchImpl: async () => {
        externalCalls += 1;
        return new Response('{}');
      },
      modelTraceProvider: async () => modelTrace,
      timeoutMs: 50
    });

    expect(result?.id).toBe('robot-orientation-story-mlx');
    expect(externalCalls).toBe(0);
  });

  it('uses auto priority and falls through invalid external output to the local HF provider on Linux', async () => {
    const seedTrace = refineTrace(request);
    const modelTrace = { ...seedTrace, id: 'robot-orientation-story-hf' };
    let workerCalls = 0;

    const result = await requestModelTrace(request, seedTrace, {
      adapterUrl: 'http://127.0.0.1:8600',
      providerSelection: 'auto',
      fetchImpl: async (url) => String(url).endsWith('/api/health')
        ? new Response(JSON.stringify({ ok: true }), { status: 200 })
        : new Response(JSON.stringify({ trace: { ...seedTrace, outputType: 'python' } }), { status: 200 }),
      modelTraceProvider: async () => {
        workerCalls += 1;
        return modelTrace;
      },
      timeoutMs: 50
    });

    expect(result?.id).toBe('robot-orientation-story-hf');
    expect(workerCalls).toBe(1);
  });

  it('reports provider diagnostics without exposing adapter URLs', async () => {
    const diagnostics = await getModelProviderDiagnostics({
      adapterUrl: 'http://secret-host.example:8600/private',
      providerSelection: 'auto',
      fetchImpl: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
      modelTraceProvider: async () => null,
      timeoutMs: 50
    });

    expect(diagnostics.providerSelection).toBe('auto');
    expect(diagnostics.providers.map((provider) => provider.id)).toEqual([
      'external-adapter',
      'hf-diffusiongemma',
      'mlx-diffusiongemma',
      'fallback'
    ]);
    expect(JSON.stringify(diagnostics)).not.toContain('secret-host');
  });

  it('reports unavailable providers when the external adapter health check fails', async () => {
    const diagnostics = await getModelProviderDiagnostics({
      adapterUrl: 'http://127.0.0.1:8600',
      providerSelection: 'auto',
      fetchImpl: async () => {
        throw new Error('connect ECONNREFUSED 127.0.0.1:8600');
      },
      modelTraceProvider: async () => null,
      timeoutMs: 50
    });

    expect(diagnostics.providers.find((provider) => provider.id === 'external-adapter')).toMatchObject({
      configured: true,
      available: false,
      reason: 'connect ECONNREFUSED 127.0.0.1:8600'
    });
  });
});
