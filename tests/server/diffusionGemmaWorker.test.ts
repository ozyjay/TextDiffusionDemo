import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import {
  buildDiffusionGemmaWorkerEnv,
  defaultDiffusionGemmaEngine,
  defaultDiffusionGemmaPythonPath,
  DiffusionGemmaWorkerClient
} from '../../server/services/diffusionGemmaWorker';
import { refineTrace } from '../../server/services/traceService';
import type { RefineRequest } from '../../shared/types';

class FakeWorkerProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  stdin = {
    write: (data: string) => {
      this.writes.push(data);
    }
  };
  killed = false;
  writes: string[] = [];

  kill() {
    this.killed = true;
  }
}

const storyRequest: RefineRequest = {
  outputType: 'story',
  promptId: 'robot-orientation-story',
  style: 'funny',
  creativity: 'balanced',
  length: 'short',
  constraint: 'include-robot',
  steps: 5,
  mode: 'model-assisted'
};

describe('DiffusionGemma worker client', () => {
  it('uses OS-specific project virtualenv Python defaults', () => {
    expect(defaultDiffusionGemmaPythonPath('darwin')).toBe('.venv-diffusiongemma/bin/python');
    expect(defaultDiffusionGemmaPythonPath('linux')).toBe('.venv-diffusiongemma/bin/python');
    expect(defaultDiffusionGemmaPythonPath('win32')).toBe('.venv-diffusiongemma\\Scripts\\python.exe');
  });

  it('uses Transformers by default off macOS and MLX on macOS', () => {
    expect(defaultDiffusionGemmaEngine('linux')).toBe('transformers');
    expect(defaultDiffusionGemmaEngine('win32')).toBe('transformers');
    expect(defaultDiffusionGemmaEngine('darwin')).toBe('mlx');
  });

  it('preloads the system HSA runtime for Linux Transformers workers when available', () => {
    const env = buildDiffusionGemmaWorkerEnv(
      'transformers',
      'test-model',
      { PYTHONPATH: 'existing-path' },
      'linux',
      '/demo',
      (filePath) => filePath === '/usr/lib64/libhsa-runtime64.so.1'
    );

    expect(env.LD_PRELOAD).toBe('/usr/lib64/libhsa-runtime64.so.1');
    expect(env.PYTHONPATH).toBe('/demo/adapters/diffusiongemma_adapter:existing-path');
  });

  it('does not replace an explicit LD_PRELOAD setting', () => {
    const env = buildDiffusionGemmaWorkerEnv(
      'transformers',
      'test-model',
      { LD_PRELOAD: '/custom/lib.so' },
      'linux',
      '/demo',
      () => true
    );

    expect(env.LD_PRELOAD).toBe('/custom/lib.so');
  });

  it('sends JSON requests to the Python worker and returns validated traces', async () => {
    const fakeProcess = new FakeWorkerProcess();
    const client = new DiffusionGemmaWorkerClient({
      spawnImpl: () => fakeProcess as never,
      pythonPath: 'python3'
    });
    const seedTrace = refineTrace(storyRequest);
    const promise = client.requestTrace(storyRequest, seedTrace, 1000);
    const written = JSON.parse(fakeProcess.writes[0]);

    fakeProcess.stdout.emit('data', `${JSON.stringify({
      id: written.id,
      ok: true,
      trace: {
        ...seedTrace,
        id: 'robot-orientation-story-diffusiongemma',
        stages: [
          { label: 'Mask 0/8', text: '[Mask]', note: 'Model draft frame.' },
          { label: 'Final', text: 'The robot waved.', note: 'Model final.' }
        ]
      }
    })}\n`);

    const trace = await promise;

    expect(trace?.id).toBe('robot-orientation-story-diffusiongemma');
    expect(trace?.stages.map((stage) => stage.label)).toEqual(['Mask 0/8', 'Final']);
  });

  it('does not start the worker for unsupported Python requests', async () => {
    let spawned = false;
    const client = new DiffusionGemmaWorkerClient({
      spawnImpl: () => {
        spawned = true;
        return new FakeWorkerProcess() as never;
      },
      pythonPath: 'python3'
    });

    const result = await client.requestTrace(
      { ...storyRequest, outputType: 'python', promptId: 'number-guess-python' },
      refineTrace({ ...storyRequest, outputType: 'python', promptId: 'number-guess-python' }),
      1000
    );

    expect(result).toBeNull();
    expect(spawned).toBe(false);
  });

  it('returns null when the worker does not respond before the timeout', async () => {
    const fakeProcess = new FakeWorkerProcess();
    const client = new DiffusionGemmaWorkerClient({
      spawnImpl: () => fakeProcess as never,
      pythonPath: 'python3'
    });

    const result = await client.requestTrace(storyRequest, refineTrace(storyRequest), 1);

    expect(result).toBeNull();
  });

  it('returns null when the worker process fails before responding', async () => {
    const fakeProcess = new FakeWorkerProcess();
    const client = new DiffusionGemmaWorkerClient({
      spawnImpl: () => fakeProcess as never,
      pythonPath: 'missing-python'
    });

    const promise = client.requestTrace(storyRequest, refineTrace(storyRequest), 1000);
    fakeProcess.emit('error', new Error('spawn ENOENT'));

    await expect(promise).resolves.toBeNull();
  });
});
