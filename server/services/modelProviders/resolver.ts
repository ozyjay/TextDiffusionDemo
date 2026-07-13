import type { RefineRequest, Trace } from '../../../shared/types';
import { validateTrace } from '../traceService';
import type {
  ModelProviderId,
  ModelTraceProviderStrategy,
  ProviderDiagnostics
} from './types';

export type ProviderSelection = ModelProviderId | 'auto';

export interface ResolveOptions {
  selection?: string;
  timeoutMs: number;
  providerTimeoutMs?: (provider: ModelTraceProviderStrategy) => number;
  signal?: AbortSignal;
}

export async function resolveModelTrace(
  request: RefineRequest,
  seedTrace: Trace,
  providers: ModelTraceProviderStrategy[],
  options: ResolveOptions
): Promise<Trace | null> {
  const selectedProviders = selectProviders(providers, normaliseProviderSelection(options.selection));

  for (const provider of selectedProviders) {
    if (options.signal?.aborted) {
      break;
    }
    if (!provider.supports(request)) {
      provider.setStatus('unsupported', `Provider does not support ${request.outputType} output.`);
      continue;
    }

    const availability = await provider.isAvailable();
    if (!availability.available) {
      provider.setStatus('unavailable', availability.reason);
      continue;
    }

    const timeoutMs = options.providerTimeoutMs?.(provider) ?? options.timeoutMs;
    const trace = await provider.refine(request, seedTrace, timeoutMs, options.signal);
    if (options.signal?.aborted) {
      break;
    }
    if (!trace) {
      if (provider.lastStatus().lastOutcome === 'not-run') {
        provider.setStatus('no-trace', 'Provider returned no trace.');
      }
      continue;
    }

    try {
      const validated = validateTrace(trace);
      if (validated.promptId !== request.promptId || validated.outputType !== request.outputType) {
        provider.setStatus('invalid', 'Trace did not match the requested prompt or output lane.');
        continue;
      }
      provider.setStatus('success', 'Provider returned a valid trace.');
      return validated;
    } catch (error) {
      provider.setStatus('invalid', error instanceof Error ? error.message : 'Trace validation failed.');
    }
  }

  return null;
}

export async function getProviderDiagnostics(
  providers: ModelTraceProviderStrategy[],
  selection?: string
): Promise<ProviderDiagnostics> {
  const providerSelection = normaliseProviderSelection(selection);
  await Promise.all(providers.map((provider) => provider.isAvailable()));
  return {
    providerSelection,
    providers: providers.map((provider) => provider.lastStatus())
  };
}

export function normaliseProviderSelection(selection: string | undefined): ProviderSelection {
  if (
    selection === 'external-adapter' ||
    selection === 'modeldeck' ||
    selection === 'redhat-vllm' ||
    selection === 'hf-diffusiongemma' ||
    selection === 'mlx-diffusiongemma' ||
    selection === 'fallback'
  ) {
    return selection;
  }
  return 'auto';
}

function selectProviders(
  providers: ModelTraceProviderStrategy[],
  selection: ProviderSelection
): ModelTraceProviderStrategy[] {
  if (selection === 'auto') {
    return providers;
  }
  return providers.filter((provider) => provider.id === selection);
}
