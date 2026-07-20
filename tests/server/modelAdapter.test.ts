import { describe, expect, it } from 'vitest';
import { getModelProviderDiagnostics, requestModelTrace } from '../../server/services/modelAdapter';
import { RedHatVllmProvider } from '../../server/services/modelProviders/redHatVllmProvider';
import { ModelDeckProvider } from '../../server/services/modelProviders/modelDeckProvider';
import type { ModelTraceProviderStrategy, ProviderAvailability, ProviderStatus } from '../../server/services/modelProviders/types';
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
  function createFakeProvider(
    details: Pick<ModelTraceProviderStrategy, 'id' | 'label' | 'kind'>,
    refine: ModelTraceProviderStrategy['refine'],
    availability: ProviderAvailability = { configured: true, available: true }
  ): ModelTraceProviderStrategy {
    let status: ProviderStatus = {
      id: details.id,
      label: details.label,
      kind: details.kind,
      configured: availability.configured,
      available: availability.available,
      reason: availability.reason,
      lastOutcome: 'not-run'
    };

    return {
      ...details,
      supports: () => true,
      isAvailable: async () => availability,
      refine,
      lastStatus: () => status,
      setStatus: (lastOutcome, lastReason) => {
        status = { ...status, lastOutcome, lastReason };
      }
    };
  }

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
      modelTraceProvider: async () => null,
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
      modelTraceProvider: async () => null,
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

  it('uses a Red Hat vLLM chat completions provider when explicitly selected', async () => {
    const seedTrace = refineTrace(request);
    const provider = new RedHatVllmProvider(
      'http://127.0.0.1:8000/v1',
      'RedHatAI/gemma-4-26B-A4B-it-FP8-Dynamic',
      'EMPTY',
      async (url, init) => {
        if (String(url).endsWith('/models')) {
          return new Response(JSON.stringify({ data: [] }), { status: 200 });
        }

        expect(String(url)).toBe('http://127.0.0.1:8000/v1/chat/completions');
        const body = JSON.parse(String(init?.body));
        expect(body.model).toBe('RedHatAI/gemma-4-26B-A4B-it-FP8-Dynamic');
        expect(body.messages[0].content).toContain('A robot joins university orientation.');
        return new Response(JSON.stringify({
          choices: [
            {
              message: {
                content: 'A robot joined orientation, downloaded the map, and still asked a vending machine for directions.'
              }
            }
          ]
        }), { status: 200 });
      }
    );

    const result = await requestModelTrace(request, seedTrace, {
      providers: [provider],
      providerSelection: 'redhat-vllm',
      timeoutMs: 50
    });

    expect(result?.id).toBe('robot-orientation-story-redhat-vllm');
    expect(result?.stages.map((stage) => stage.label)).toEqual(['Noise', 'Rough', 'Clear', 'Styled', 'Final']);
    expect(result?.stages.at(-1)?.rawText).toContain('vending machine');
  });

  it('uses the native ModelDeck provider when explicitly selected', async () => {
    const seedTrace = refineTrace(request);
    const provider = new ModelDeckProvider({
      model: 'text-diffusion-lab-q4',
      fetchImpl: async (url) => {
        if (String(url).endsWith('/v1/health')) {
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        if (String(url).endsWith('/v1/models')) {
          return new Response(JSON.stringify({
            data: [{ id: 'text-diffusion-lab-q4', ready: true }]
          }), { status: 200 });
        }
        expect(String(url)).toBe('http://127.0.0.1:8600/v1/diffuse');
        return new Response(JSON.stringify({
          job_id: 'selected-job',
          state: 'complete',
          text: 'A robot found orientation by following a very organized duck.'
        }), { status: 200 });
      }
    });

    const result = await requestModelTrace(request, seedTrace, {
      providers: [provider],
      providerSelection: 'modeldeck',
      timeoutMs: 50,
      modelDeckTimeoutMs: 100
    });

    expect(result?.id).toBe('robot-orientation-story-modeldeck');
    expect(result?.stages.at(-1)?.text).toBe(
      'A robot found orientation by following a very organized duck.'
    );
  });

  it('uses the longer worker timeout only for local worker providers', async () => {
    const seedTrace = refineTrace(request);
    const seenTimeouts: number[] = [];
    const providers: ModelTraceProviderStrategy[] = [
      createFakeProvider(
        { id: 'external-adapter', label: 'External model adapter', kind: 'external' },
        async (_request, _seedTrace, timeoutMs) => {
          seenTimeouts.push(timeoutMs);
          return null;
        }
      ),
      createFakeProvider(
        { id: 'hf-diffusiongemma', label: 'HF Transformers DiffusionGemma', kind: 'local-worker' },
        async (_request, _seedTrace, timeoutMs) => {
          seenTimeouts.push(timeoutMs);
          return null;
        }
      )
    ];

    await requestModelTrace(request, seedTrace, {
      providers,
      timeoutMs: 50,
      workerTimeoutMs: 5000
    });

    expect(seenTimeouts).toEqual([50, 5000]);
  });

  it('reports provider diagnostics without exposing adapter URLs', async () => {
    const diagnostics = await getModelProviderDiagnostics({
      adapterUrl: 'http://secret-host.example:8600/private',
      providerSelection: 'auto',
      fetchImpl: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
      modelTraceProvider: async () => null,
      timeoutMs: 50,
      platform: 'linux'
    });

    expect(diagnostics.providerSelection).toBe('auto');
    expect(diagnostics.providers.map((provider) => provider.id)).toEqual([
      'modeldeck',
      'external-adapter',
      'redhat-vllm',
      'hf-diffusiongemma',
      'fallback'
    ]);
    expect(JSON.stringify(diagnostics)).not.toContain('secret-host');
  });

  it('does not request legacy adapter health when MODEL_ADAPTER_URL is unset', async () => {
    const urls: string[] = [];

    await getModelProviderDiagnostics({
      adapterUrl: '',
      providerSelection: 'modeldeck',
      fetchImpl: async (url) => {
        urls.push(String(url));
        return String(url).endsWith('/v1/models')
          ? new Response(JSON.stringify({ data: [] }), { status: 200 })
          : new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
      modelTraceProvider: async () => null,
      platform: 'linux'
    });

    expect(urls.some((url) => url.endsWith('/api/health'))).toBe(false);
  });

  it('uses only the MLX local provider in auto mode on macOS', async () => {
    const diagnostics = await getModelProviderDiagnostics({
      adapterUrl: '',
      providerSelection: 'auto',
      fetchImpl: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
      modelTraceProvider: async () => null,
      timeoutMs: 50,
      platform: 'darwin'
    });

    expect(diagnostics.providers.map((provider) => provider.id)).toEqual([
      'modeldeck',
      'external-adapter',
      'redhat-vllm',
      'mlx-diffusiongemma',
      'fallback'
    ]);
  });

  it('reports explicit MLX selection as unavailable on non-macOS by default', async () => {
    const diagnostics = await getModelProviderDiagnostics({
      adapterUrl: '',
      providerSelection: 'mlx-diffusiongemma',
      fetchImpl: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
      timeoutMs: 50,
      platform: 'linux'
    });

    expect(diagnostics.providers.find((provider) => provider.id === 'mlx-diffusiongemma')).toMatchObject({
      available: false,
      reason: 'MLX DiffusionGemma is only enabled by default on macOS.'
    });
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
