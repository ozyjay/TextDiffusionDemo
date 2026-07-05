import type { RefineRequest, Trace } from '../../shared/types';
import { ExternalAdapterProvider } from './modelProviders/externalAdapterProvider';
import { FallbackProvider } from './modelProviders/fallbackProvider';
import {
  HfDiffusionGemmaProvider,
  MlxDiffusionGemmaProvider,
  type WorkerTraceProvider
} from './modelProviders/mlxDiffusionGemmaProvider';
import {
  getProviderDiagnostics,
  normaliseProviderSelection,
  resolveModelTrace
} from './modelProviders/resolver';
import type { ModelTraceProviderStrategy, ProviderDiagnostics } from './modelProviders/types';

type FetchLike = typeof fetch;

export interface ModelAdapterOptions {
  adapterUrl?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  workerTimeoutMs?: number;
  providerSelection?: string;
  modelTraceProvider?: WorkerTraceProvider;
  providers?: ModelTraceProviderStrategy[];
  platform?: NodeJS.Platform;
}

export async function requestModelTrace(
  request: RefineRequest,
  seedTrace: Trace,
  options: ModelAdapterOptions = {}
): Promise<Trace | null> {
  const providers = options.providers ?? createDefaultProviders(options);
  const timeoutMs = options.timeoutMs ?? 30000;
  const workerTimeoutMs = options.workerTimeoutMs ?? 300000;
  return resolveModelTrace(request, seedTrace, providers, {
    selection: options.providerSelection ?? process.env.MODEL_PROVIDER,
    timeoutMs,
    providerTimeoutMs: (provider) => provider.kind === 'local-worker' ? workerTimeoutMs : timeoutMs
  });
}

export async function getModelProviderDiagnostics(
  options: ModelAdapterOptions = {}
): Promise<ProviderDiagnostics> {
  const providers = options.providers ?? createDefaultProviders(options);
  return getProviderDiagnostics(providers, options.providerSelection ?? process.env.MODEL_PROVIDER);
}

function createDefaultProviders(options: ModelAdapterOptions): ModelTraceProviderStrategy[] {
  const platform = options.platform ?? process.platform;
  const selection = normaliseProviderSelection(options.providerSelection ?? process.env.MODEL_PROVIDER);
  const localProviders: ModelTraceProviderStrategy[] = platform === 'darwin'
    ? [new MlxDiffusionGemmaProvider(options.modelTraceProvider, platform)]
    : [new HfDiffusionGemmaProvider(options.modelTraceProvider, platform)];

  if (
    selection === 'mlx-diffusiongemma' &&
    !localProviders.some((provider) => provider.id === 'mlx-diffusiongemma')
  ) {
    localProviders.push(new MlxDiffusionGemmaProvider(options.modelTraceProvider, platform));
  }

  if (
    selection === 'hf-diffusiongemma' &&
    !localProviders.some((provider) => provider.id === 'hf-diffusiongemma')
  ) {
    localProviders.push(new HfDiffusionGemmaProvider(options.modelTraceProvider, platform));
  }

  return [
    new ExternalAdapterProvider(options.adapterUrl ?? process.env.MODEL_ADAPTER_URL, options.fetchImpl),
    ...localProviders,
    new FallbackProvider()
  ];
}
