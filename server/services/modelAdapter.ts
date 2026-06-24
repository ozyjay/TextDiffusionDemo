import type { RefineRequest, Trace } from '../../shared/types';
import { validateTrace } from './traceService';
import { requestDiffusionGemmaTrace } from './diffusionGemmaWorker';

type FetchLike = typeof fetch;

export interface ModelAdapterOptions {
  adapterUrl?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  modelTraceProvider?: (request: RefineRequest, seedTrace: Trace, timeoutMs: number) => Promise<Trace | null>;
}

export async function requestModelTrace(
  request: RefineRequest,
  seedTrace: Trace,
  options: ModelAdapterOptions = {}
): Promise<Trace | null> {
  const adapterUrl = options.adapterUrl?.trim();
  if (!adapterUrl) {
    const provider = options.modelTraceProvider ?? requestDiffusionGemmaTrace;
    return provider(request, seedTrace, options.timeoutMs ?? 30000);
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30000);

  try {
    const response = await fetchImpl(`${adapterUrl.replace(/\/$/, '')}/api/refine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request, seedTrace }),
      signal: controller.signal
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as unknown;
    const trace = extractTrace(data);
    if (!trace) {
      return null;
    }

    const validated = validateTrace(trace);
    if (validated.promptId !== request.promptId || validated.outputType !== request.outputType) {
      return null;
    }

    return validated;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function extractTrace(data: unknown): Trace | null {
  if (!isRecord(data)) {
    return null;
  }

  if ('trace' in data) {
    return isRecord(data.trace) ? data.trace as unknown as Trace : null;
  }

  return data as unknown as Trace;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
