import type { RefineRequest, Trace } from '../../../shared/types';
import { requestDiffusionGemmaTrace } from '../diffusionGemmaWorker';
import { BaseModelProvider } from './base';
import type { ModelTraceProviderStrategy, ProviderAvailability } from './types';

export type WorkerTraceProvider = (
  request: RefineRequest,
  seedTrace: Trace,
  timeoutMs: number
) => Promise<Trace | null>;

export class MlxDiffusionGemmaProvider extends BaseModelProvider implements ModelTraceProviderStrategy {
  readonly id = 'mlx-diffusiongemma' as const;
  readonly label = 'MLX DiffusionGemma';
  readonly kind = 'local-worker' as const;

  constructor(private readonly workerProvider: WorkerTraceProvider = requestDiffusionGemmaTrace) {
    super();
  }

  supports(request: RefineRequest): boolean {
    return request.outputType === 'story';
  }

  async isAvailable(): Promise<ProviderAvailability> {
    return this.updateAvailability({
      configured: true,
      available: true,
      reason: 'MLX worker will be started lazily.'
    });
  }

  async refine(request: RefineRequest, seedTrace: Trace, timeoutMs: number): Promise<Trace | null> {
    return this.workerProvider(request, seedTrace, timeoutMs);
  }
}
