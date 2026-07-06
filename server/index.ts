import './registerEnv';
import { createApp } from './app';
import { getModelProviderDiagnostics, preloadLocalModel } from './services/modelAdapter';
import { setModelRuntimeStatus } from './services/modelRuntimeStatus';
import { formatModelStatusLines } from './services/modelStatusConsole';

const host = process.env.BACKEND_HOST ?? '127.0.0.1';
const port = Number(process.env.BACKEND_PORT ?? 8300);

createApp().listen(port, host, () => {
  console.log(`Text Diffusion Lab API listening at http://${host}:${port}`);
  void bootModelStatus();
});

async function bootModelStatus(): Promise<void> {
  await logModelStatus();
  if (!envFlag('MODEL_PRELOAD', false)) {
    setModelRuntimeStatus({
      state: 'fallback',
      preloadEnabled: false,
      message: 'Model preload is disabled; scripted fallback remains available.'
    });
    console.log('[model] preload: disabled; set MODEL_PRELOAD=1 to load the local model at startup');
    return;
  }

  const timeoutMs = envNumber('MODEL_PRELOAD_TIMEOUT_MS', envNumber('MODEL_WORKER_TIMEOUT_MS', 600000));
  setModelRuntimeStatus({
    state: 'loading',
    preloadEnabled: true,
    loadingTimeoutMs: timeoutMs,
    message: 'Local model preload is running.'
  });
  console.log(`[model] preload: starting local model preload with ${timeoutMs}ms timeout`);
  const startedAt = Date.now();
  const result = await preloadLocalModel({
    providerSelection: process.env.MODEL_PROVIDER,
    workerTimeoutMs: timeoutMs
  });
  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  if (result.ok) {
    setModelRuntimeStatus({
      state: 'ready',
      providerId: result.providerId,
      preloadEnabled: true,
      message: `Local model is preloaded and ready after ${elapsedSeconds}s.`
    });
    console.log(`[model] preload: ${result.providerId} ready after ${elapsedSeconds}s`);
    return;
  }
  setModelRuntimeStatus({
    state: 'error',
    providerId: result.providerId,
    preloadEnabled: true,
    message: result.reason ?? 'Local model preload failed.'
  });
  console.warn(`[model] preload: ${result.providerId} not ready after ${elapsedSeconds}s - ${result.reason}`);
}

async function logModelStatus(): Promise<void> {
  try {
    const diagnostics = await getModelProviderDiagnostics({
      timeoutMs: Number(process.env.MODEL_ADAPTER_TIMEOUT_MS ?? 30000)
    });
    for (const line of formatModelStatusLines(diagnostics, {
      modelId: process.env.DIFFUSIONGEMMA_MODEL,
      engine: process.env.DIFFUSIONGEMMA_ENGINE
    })) {
      console.log(line);
    }
  } catch (error) {
    console.warn(
      `[model] status unavailable: ${error instanceof Error ? error.message : 'unknown diagnostics error'}`
    );
  }
}

function envFlag(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(value);
}

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
