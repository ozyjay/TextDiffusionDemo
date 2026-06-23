import { describe, expect, it } from 'vitest';
import { requestModelTrace } from '../../server/services/modelAdapter';
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
      fetchImpl: async (_url, init) => {
        expect(JSON.parse(String(init?.body)).seedTrace.id).toBe(seedTrace.id);
        return new Response(JSON.stringify({ trace: modelTrace }), { status: 200 });
      },
      timeoutMs: 50
    });

    expect(result?.id).toBe('robot-orientation-story-model');
    expect(result?.stages.at(-1)?.text).toContain('Model-assisted polish');
  });

  it('returns null when no adapter URL is configured', async () => {
    const seedTrace = refineTrace(request);

    const result = await requestModelTrace(request, seedTrace, {
      adapterUrl: '',
      fetchImpl: async () => new Response('{}'),
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
      fetchImpl: async () => new Response(JSON.stringify({ trace: mismatchedTrace }), { status: 200 }),
      timeoutMs: 50
    });

    expect(result).toBeNull();
  });
});
