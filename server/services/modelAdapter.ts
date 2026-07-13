import type { RefineRequest, Trace } from '../../shared/types';
import { ExternalAdapterProvider } from './modelProviders/externalAdapterProvider';
import { FallbackProvider } from './modelProviders/fallbackProvider';
import { RedHatVllmProvider } from './modelProviders/redHatVllmProvider';
import { ModelDeckProvider } from './modelProviders/modelDeckProvider';
import {
  preloadHfDiffusionGemma,
  preloadMlxDiffusionGemma
} from './diffusionGemmaWorker';
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
import type { ModelProviderId } from './modelProviders/types';

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
  signal?: AbortSignal;
  modelDeckBaseUrl?: string;
  modelDeckModel?: string;
  modelDeckTimeoutMs?: number;
  modelDeckPollIntervalMs?: number;
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
    providerTimeoutMs: (provider) => provider.kind === 'local-worker'
      ? workerTimeoutMs
      : provider.id === 'modeldeck'
        ? options.modelDeckTimeoutMs ?? envSeconds('MODELDECK_TIMEOUT_SECONDS', 60) * 1000
        : timeoutMs,
    signal: options.signal
  });
}

export async function getModelProviderDiagnostics(
  options: ModelAdapterOptions = {}
): Promise<ProviderDiagnostics> {
  const providers = options.providers ?? createDefaultProviders(options);
  return getProviderDiagnostics(providers, options.providerSelection ?? process.env.MODEL_PROVIDER);
}

export async function preloadLocalModel(options: ModelAdapterOptions = {}): Promise<{
  ok: boolean;
  providerId: ModelProviderId;
  reason?: string;
}> {
  const platform = options.platform ?? process.platform;
  const selection = normaliseProviderSelection(options.providerSelection ?? process.env.MODEL_PROVIDER);
  const timeoutMs = options.workerTimeoutMs ?? 600000;
  const providerId = platform === 'darwin' ? 'mlx-diffusiongemma' : 'hf-diffusiongemma';

  if (
    selection === 'modeldeck' ||
    selection === 'external-adapter' ||
    selection === 'redhat-vllm' ||
    selection === 'fallback'
  ) {
    return {
      ok: false,
      providerId: selection,
      reason: `MODEL_PROVIDER=${selection} does not use a local model worker.`
    };
  }

  if (selection === 'mlx-diffusiongemma' && platform !== 'darwin') {
    return {
      ok: false,
      providerId: 'mlx-diffusiongemma',
      reason: 'MLX preload is only available on macOS.'
    };
  }

  const ok = providerId === 'mlx-diffusiongemma'
    ? await preloadMlxDiffusionGemma(timeoutMs)
    : await preloadHfDiffusionGemma(timeoutMs);

  return {
    ok,
    providerId,
    reason: ok ? undefined : 'Local model worker did not report ready before the preload timeout.'
  };
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
    new ModelDeckProvider({
      baseUrl: options.modelDeckBaseUrl,
      model: options.modelDeckModel,
      pollIntervalMs: options.modelDeckPollIntervalMs,
      fetchImpl: options.fetchImpl
    }),
    new ExternalAdapterProvider(options.adapterUrl ?? process.env.MODEL_ADAPTER_URL, options.fetchImpl),
    new RedHatVllmProvider(
      process.env.REDHAT_VLLM_BASE_URL,
      process.env.REDHAT_VLLM_MODEL,
      process.env.REDHAT_VLLM_API_KEY,
      options.fetchImpl
    ),
    ...localProviders,
    new FallbackProvider()
  ];
}

function envSeconds(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
