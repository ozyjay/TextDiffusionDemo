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
    const response = await request(createApp({ modelAdapterUrl: '' }))
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
