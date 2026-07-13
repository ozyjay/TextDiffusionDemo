import express from 'express';
import type { Response } from 'express';
import {
  getPrompts,
  getTraces,
  refineTrace
} from './services/traceService';
import { getModelProviderDiagnostics, requestModelTrace } from './services/modelAdapter';
import { getModelRuntimeStatus } from './services/modelRuntimeStatus';
import type { RefineRequest } from '../shared/types';
import type { Trace } from '../shared/types';

const CUSTOM_PROMPT_MIN_LENGTH = 8;
const CUSTOM_PROMPT_MAX_LENGTH = 140;

export type ModelTraceProvider = (
  request: RefineRequest,
  seedTrace: Trace,
  timeoutMs: number
) => Promise<Trace | null>;

export interface AppOptions {
  modelAdapterUrl?: string;
  modelAdapterTimeoutMs?: number;
  modelWorkerTimeoutMs?: number;
  modelProvider?: string;
  fetchImpl?: typeof fetch;
  modelTraceProvider?: ModelTraceProvider;
}

interface RefinementResult {
  mode: 'scripted' | 'template' | 'model-assisted' | 'model-fallback';
  trace: Trace;
}

export function createApp(options: AppOptions = {}) {
  const app = express();

  app.use(express.json());

  app.get('/api/health', (_request, response) => {
    response.json({
      ok: true,
      service: 'text-diffusion-lab',
      mode: process.env.DEMO_MODE ?? 'development',
      port: 8300
    });
  });

  app.get('/api/prompts', (_request, response) => {
    response.json({ prompts: getPrompts() });
  });

  app.get('/api/traces', (_request, response) => {
    response.json({ traces: getTraces() });
  });

  app.get('/api/model-providers', async (_request, response) => {
    response.json(await getModelProviderDiagnostics({
      adapterUrl: options.modelAdapterUrl ?? process.env.MODEL_ADAPTER_URL,
      fetchImpl: options.fetchImpl,
      timeoutMs: options.modelAdapterTimeoutMs ?? envNumber('MODEL_ADAPTER_TIMEOUT_MS', 30000),
      workerTimeoutMs: options.modelWorkerTimeoutMs ?? envNumber('MODEL_WORKER_TIMEOUT_MS', 300000),
      providerSelection: options.modelProvider ?? process.env.MODEL_PROVIDER,
      modelTraceProvider: options.modelTraceProvider
    }));
  });

  app.get('/api/model-status', (_request, response) => {
    response.json({ status: getModelRuntimeStatus() });
  });

  app.post('/api/refine', async (request, response) => {
    const body = request.body as Partial<RefineRequest>;
    const refineRequest = buildRefineRequest(body);
    if (!refineRequest) {
      response.status(400).json({ error: 'promptId and style are required.' });
      return;
    }

    const controller = new AbortController();
    request.once('aborted', () => controller.abort());
    response.json(await resolveRefinement(refineRequest, options, controller.signal));
  });

  app.post('/api/refine/stream', async (request, response) => {
    const refineRequest = buildRefineRequest(request.body as Partial<RefineRequest>);
    if (!refineRequest) {
      response.status(400).json({ error: 'promptId and style are required.' });
      return;
    }

    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    writeSse(response, 'ready', { ok: true });
    const controller = new AbortController();
    request.once('aborted', () => controller.abort());
    response.once('close', () => {
      if (!response.writableEnded) {
        controller.abort();
      }
    });

    try {
      const result = await resolveRefinement(refineRequest, options, controller.signal);
      const delayMs = clampDelay(refineRequest.streamDelayMs);
      for (const [index, stage] of result.trace.stages.entries()) {
        writeSse(response, 'frame', { index, stage });
        if (delayMs > 0 && index < result.trace.stages.length - 1) {
          await sleep(delayMs);
        }
      }
      writeSse(response, 'done', result);
      response.end();
    } catch (error) {
      writeSse(response, 'error', {
        message: error instanceof Error ? error.message : 'Refinement stream failed.'
      });
      response.end();
    }
  });

  return app;
}

function buildRefineRequest(body: Partial<RefineRequest>): RefineRequest | null {
  if (!body.promptId || !body.style) {
    return null;
  }

  return {
    outputType: body.outputType ?? 'story',
    promptId: body.promptId,
    style: body.style,
    creativity: body.creativity ?? 'balanced',
    length: body.length ?? 'medium',
    constraint: body.constraint ?? 'none',
    steps: body.steps ?? 5,
    maxLength: typeof body.maxLength === 'number' ? body.maxLength : undefined,
    denoisingSteps: typeof body.denoisingSteps === 'number' ? body.denoisingSteps : undefined,
    blockLength: typeof body.blockLength === 'number' ? body.blockLength : undefined,
    temperature: typeof body.temperature === 'number' ? body.temperature : undefined,
    seed: typeof body.seed === 'number' ? body.seed : undefined,
    streamDelayMs: typeof body.streamDelayMs === 'number' ? body.streamDelayMs : undefined,
    includeEveryFrame: body.includeEveryFrame === true,
    mode: body.mode ?? 'scripted',
    customPrompt: typeof body.customPrompt === 'string' ? body.customPrompt : undefined
  };
}

async function resolveRefinement(
  refineRequest: RefineRequest,
  options: AppOptions,
  signal?: AbortSignal
): Promise<RefinementResult> {
  const customPrompt = refineRequest.mode === 'model-assisted'
    ? normaliseCustomPrompt(refineRequest)
    : null;
  const seedTrace = buildSeedTrace(refineRequest, customPrompt);

  if (refineRequest.mode === 'model-assisted') {
    if (refineRequest.outputType !== 'story') {
      return { mode: 'model-fallback', trace: seedTrace };
    }

    const modelTrace = await requestModelTrace(refineRequest, seedTrace, {
      adapterUrl: options.modelAdapterUrl ?? process.env.MODEL_ADAPTER_URL,
      fetchImpl: options.fetchImpl,
      timeoutMs: options.modelAdapterTimeoutMs ?? envNumber('MODEL_ADAPTER_TIMEOUT_MS', 30000),
      workerTimeoutMs: options.modelWorkerTimeoutMs ?? envNumber('MODEL_WORKER_TIMEOUT_MS', 300000),
      providerSelection: options.modelProvider ?? process.env.MODEL_PROVIDER,
      modelTraceProvider: options.modelTraceProvider,
      signal
    });

    if (modelTrace) {
      return { mode: 'model-assisted', trace: modelTrace };
    }

    return { mode: 'model-fallback', trace: seedTrace };
  }

  return {
    mode: seedTrace.id.endsWith('-template') ? 'template' : 'scripted',
    trace: seedTrace
  };
}

function buildSeedTrace(refineRequest: RefineRequest, promptOverride: string | null): Trace {
  const trace = refineTrace(refineRequest);
  return {
    ...trace,
    prompt: promptOverride ?? trace.prompt,
    style: refineRequest.style,
    controls: {
      creativity: refineRequest.creativity,
      length: refineRequest.length,
      constraint: refineRequest.constraint,
      steps: refineRequest.steps
    }
  };
}

function writeSse(response: Response, event: string, data: unknown): void {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
}

function clampDelay(value: number | undefined): number {
  if (!Number.isFinite(value) || value === undefined) {
    return 250;
  }
  return Math.max(0, Math.min(value, 3200));
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function normaliseCustomPrompt(request: Pick<RefineRequest, 'outputType' | 'customPrompt'>): string | null {
  if (request.outputType !== 'story') {
    return null;
  }

  const prompt = request.customPrompt?.trim() ?? '';
  if (prompt.length < CUSTOM_PROMPT_MIN_LENGTH || prompt.length > CUSTOM_PROMPT_MAX_LENGTH) {
    return null;
  }

  return prompt;
}

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
