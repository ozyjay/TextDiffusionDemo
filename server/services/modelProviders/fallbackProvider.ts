import type { RefineRequest, Trace } from '../../../shared/types';
import { BaseModelProvider } from './base';
import type { ModelTraceProviderStrategy, ProviderAvailability } from './types';

export class FallbackProvider extends BaseModelProvider implements ModelTraceProviderStrategy {
  readonly id = 'fallback' as const;
  readonly label = 'Scripted fallback';
  readonly kind = 'fallback' as const;

  supports(_request: RefineRequest): boolean {
    return true;
  }

  async isAvailable(): Promise<ProviderAvailability> {
    return this.updateAvailability({
      configured: true,
      available: true,
      reason: 'Always available through scripted/template traces.'
    });
  }

  async refine(_request: RefineRequest, _seedTrace: Trace, _timeoutMs: number): Promise<Trace | null> {
    return null;
  }
}
