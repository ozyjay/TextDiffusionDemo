import type { RefineRequest, Trace } from '../../../shared/types';
import { BaseModelProvider } from './base';
import type { ModelTraceProviderStrategy, ProviderAvailability } from './types';

type FetchLike = typeof fetch;

export class ExternalAdapterProvider extends BaseModelProvider implements ModelTraceProviderStrategy {
  readonly id = 'external-adapter' as const;
  readonly label = 'External model adapter';
  readonly kind = 'external' as const;

  constructor(
    private readonly adapterUrl: string | undefined,
    private readonly fetchImpl: FetchLike = fetch
  ) {
    super();
  }

  supports(_request: RefineRequest): boolean {
    return true;
  }

  async isAvailable(): Promise<ProviderAvailability> {
    const configured = Boolean(this.adapterUrl?.trim());
    return this.updateAvailability({
      configured,
      available: configured,
      reason: configured ? 'Configured.' : 'MODEL_ADAPTER_URL is not set.'
    });
  }

  async refine(request: RefineRequest, seedTrace: Trace, timeoutMs: number): Promise<Trace | null> {
    const adapterUrl = this.adapterUrl?.trim();
    if (!adapterUrl) {
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.fetchImpl(`${adapterUrl.replace(/\/$/, '')}/api/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request, seedTrace }),
        signal: controller.signal
      });

      if (!response.ok) {
        this.setStatus('error', `Adapter returned HTTP ${response.status}.`);
        return null;
      }

      const trace = extractTrace(await response.json());
      if (!trace) {
        this.setStatus('no-trace', 'Adapter response did not include a trace.');
        return null;
      }

      return trace;
    } catch (error) {
      this.setStatus('error', error instanceof Error ? error.message : 'Adapter request failed.');
      return null;
    } finally {
      clearTimeout(timeout);
    }
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
