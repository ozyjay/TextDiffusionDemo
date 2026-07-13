import type { RefineRequest, Trace } from '../../../shared/types';

export type ModelProviderId =
  | 'modeldeck'
  | 'external-adapter'
  | 'redhat-vllm'
  | 'hf-diffusiongemma'
  | 'mlx-diffusiongemma'
  | 'fallback';
export type ModelProviderKind = 'external' | 'local-worker' | 'fallback';
export type ProviderOutcome =
  | 'not-run'
  | 'success'
  | 'unavailable'
  | 'unsupported'
  | 'invalid'
  | 'no-trace'
  | 'error';

export interface ProviderAvailability {
  configured: boolean;
  available: boolean;
  reason?: string;
}

export interface ProviderStatus extends ProviderAvailability {
  id: ModelProviderId;
  label: string;
  kind: ModelProviderKind;
  lastOutcome: ProviderOutcome;
  lastReason?: string;
}

export interface ModelTraceProviderStrategy {
  id: ModelProviderId;
  label: string;
  kind: ModelProviderKind;
  supports(request: RefineRequest): boolean;
  isAvailable(): Promise<ProviderAvailability>;
  refine(request: RefineRequest, seedTrace: Trace, timeoutMs: number, signal?: AbortSignal): Promise<Trace | null>;
  lastStatus(): ProviderStatus;
  setStatus(outcome: ProviderOutcome, reason?: string): void;
}

export interface ProviderDiagnostics {
  providerSelection: ModelProviderId | 'auto';
  providers: ProviderStatus[];
}

export function createInitialStatus(
  provider: Pick<ModelTraceProviderStrategy, 'id' | 'label' | 'kind'>,
  availability: ProviderAvailability = { configured: false, available: false, reason: 'Not checked.' }
): ProviderStatus {
  return {
    id: provider.id,
    label: provider.label,
    kind: provider.kind,
    configured: availability.configured,
    available: availability.available,
    reason: availability.reason,
    lastOutcome: 'not-run'
  };
}
