import type { RefineRequest, Trace } from '../../shared/types';
import { ExternalAdapterProvider } from './modelProviders/externalAdapterProvider';
import { FallbackProvider } from './modelProviders/fallbackProvider';
import { MlxDiffusionGemmaProvider, type WorkerTraceProvider } from './modelProviders/mlxDiffusionGemmaProvider';
import {
  getProviderDiagnostics,
  resolveModelTrace
} from './modelProviders/resolver';
import type { ModelTraceProviderStrategy, ProviderDiagnostics } from './modelProviders/types';

type FetchLike = typeof fetch;

export interface ModelAdapterOptions {
  adapterUrl?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  providerSelection?: string;
  modelTraceProvider?: WorkerTraceProvider;
  providers?: ModelTraceProviderStrategy[];
}

export async function requestModelTrace(
  request: RefineRequest,
  seedTrace: Trace,
  options: ModelAdapterOptions = {}
): Promise<Trace | null> {
  const providers = options.providers ?? createDefaultProviders(options);
  return resolveModelTrace(request, seedTrace, providers, {
    selection: options.providerSelection ?? process.env.MODEL_PROVIDER,
    timeoutMs: options.timeoutMs ?? 30000
  });
}

export async function getModelProviderDiagnostics(
  options: ModelAdapterOptions = {}
): Promise<ProviderDiagnostics> {
  const providers = options.providers ?? createDefaultProviders(options);
  return getProviderDiagnostics(providers, options.providerSelection ?? process.env.MODEL_PROVIDER);
}

function createDefaultProviders(options: ModelAdapterOptions): ModelTraceProviderStrategy[] {
  return [
    new ExternalAdapterProvider(options.adapterUrl ?? process.env.MODEL_ADAPTER_URL, options.fetchImpl),
    new MlxDiffusionGemmaProvider(options.modelTraceProvider),
    new FallbackProvider()
  ];
}
