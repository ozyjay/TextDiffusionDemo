import express from 'express';
import {
  getPrompts,
  getTraces,
  refineTrace
} from './services/traceService';
import type { RefineRequest } from '../shared/types';

export function createApp() {
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

  app.post('/api/refine', (request, response) => {
    const body = request.body as Partial<RefineRequest>;
    if (!body.promptId || !body.style) {
      response.status(400).json({ error: 'promptId and style are required.' });
      return;
    }

    const trace = refineTrace({
      outputType: body.outputType ?? 'story',
      promptId: body.promptId,
      style: body.style,
      creativity: body.creativity ?? 'balanced',
      length: body.length ?? 'medium',
      constraint: body.constraint ?? 'none',
      steps: body.steps ?? 5
    });

    response.json({ mode: trace.id.endsWith('-template') ? 'template' : 'scripted', trace });
  });

  return app;
}
