import './registerEnv';
import { createApp } from './app';
import { getModelProviderDiagnostics } from './services/modelAdapter';
import { formatModelStatusLines } from './services/modelStatusConsole';

const host = process.env.BACKEND_HOST ?? '127.0.0.1';
const port = Number(process.env.BACKEND_PORT ?? 8300);

createApp().listen(port, host, () => {
  console.log(`Text Diffusion Lab API listening at http://${host}:${port}`);
  void logModelStatus();
});

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
