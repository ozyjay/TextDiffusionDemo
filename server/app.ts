import express from 'express';
import {
  getPrompts,
  getTraces,
  refineTrace
} from './services/traceService';
import { requestModelTrace } from './services/modelAdapter';
import type { RefineRequest } from '../shared/types';
import type { Trace } from '../shared/types';

export type ModelTraceProvider = (
  request: RefineRequest,
  seedTrace: Trace,
  timeoutMs: number
) => Promise<Trace | null>;

export interface AppOptions {
  modelAdapterUrl?: string;
  modelAdapterTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  modelTraceProvider?: ModelTraceProvider;
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

  app.post('/api/refine', async (request, response) => {
    const body = request.body as Partial<RefineRequest>;
    if (!body.promptId || !body.style) {
      response.status(400).json({ error: 'promptId and style are required.' });
      return;
    }

    const refineRequest: RefineRequest = {
      outputType: body.outputType ?? 'story',
      promptId: body.promptId,
      style: body.style,
      creativity: body.creativity ?? 'balanced',
      length: body.length ?? 'medium',
      constraint: body.constraint ?? 'none',
      steps: body.steps ?? 5,
      mode: body.mode ?? 'scripted'
    };

    const seedTrace = refineTrace(refineRequest);
    if (refineRequest.mode === 'model-assisted') {
      const modelTrace = await requestModelTrace(refineRequest, seedTrace, {
        adapterUrl: options.modelAdapterUrl ?? process.env.MODEL_ADAPTER_URL,
        fetchImpl: options.fetchImpl,
        timeoutMs: options.modelAdapterTimeoutMs ?? envNumber('MODEL_ADAPTER_TIMEOUT_MS', 30000),
        modelTraceProvider: options.modelTraceProvider
      });

      if (modelTrace) {
        response.json({ mode: 'model-assisted', trace: modelTrace });
        return;
      }

      response.json({ mode: 'model-fallback', trace: seedTrace });
      return;
    }

    response.json({ mode: seedTrace.id.endsWith('-template') ? 'template' : 'scripted', trace: seedTrace });
  });

  return app;
}

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
