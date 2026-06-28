import type {
  ModelProviderId,
  ModelProviderKind,
  ProviderAvailability,
  ProviderOutcome,
  ProviderStatus
} from './types';

export abstract class BaseModelProvider {
  abstract readonly id: ModelProviderId;
  abstract readonly label: string;
  abstract readonly kind: ModelProviderKind;
  private status: ProviderStatus | null = null;

  protected updateAvailability(availability: ProviderAvailability): ProviderAvailability {
    this.status = {
      id: this.id,
      label: this.label,
      kind: this.kind,
      configured: availability.configured,
      available: availability.available,
      reason: availability.reason,
      lastOutcome: this.status?.lastOutcome ?? 'not-run',
      lastReason: this.status?.lastReason
    };
    return availability;
  }

  setStatus(outcome: ProviderOutcome, reason?: string): void {
    const current = this.status ?? {
      id: this.id,
      label: this.label,
      kind: this.kind,
      configured: false,
      available: false,
      reason: 'Not checked.',
      lastOutcome: 'not-run'
    };
    this.status = {
      ...current,
      lastOutcome: outcome,
      lastReason: reason
    };
  }

  lastStatus(): ProviderStatus {
    return this.status ?? {
      id: this.id,
      label: this.label,
      kind: this.kind,
      configured: false,
      available: false,
      reason: 'Not checked.',
      lastOutcome: 'not-run'
    };
  }
}
