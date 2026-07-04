import { existsSync } from 'node:fs';
import type { RefineRequest, Trace } from '../../../shared/types';
import {
  defaultDiffusionGemmaPythonPath,
  requestHfDiffusionGemmaTrace,
  requestMlxDiffusionGemmaTrace
} from '../diffusionGemmaWorker';
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

  constructor(private readonly workerProvider: WorkerTraceProvider = requestMlxDiffusionGemmaTrace) {
    super();
  }

  supports(request: RefineRequest): boolean {
    return request.outputType === 'story';
  }

  async isAvailable(): Promise<ProviderAvailability> {
    if (this.workerProvider !== requestMlxDiffusionGemmaTrace) {
      return this.updateAvailability({
        configured: true,
        available: true,
        reason: 'Custom worker provider configured.'
      });
    }

    const pythonPath = process.env.DIFFUSIONGEMMA_PYTHON ?? defaultDiffusionGemmaPythonPath();
    if (!existsSync(pythonPath)) {
      return this.updateAvailability({
        configured: true,
        available: false,
        reason: `Python worker executable was not found at ${pythonPath}.`
      });
    }

    return this.updateAvailability({
      configured: true,
      available: true,
      reason: 'Python worker executable is present; model will be loaded lazily.'
    });
  }

  async refine(request: RefineRequest, seedTrace: Trace, timeoutMs: number): Promise<Trace | null> {
    return this.workerProvider(request, seedTrace, timeoutMs);
  }
}

export class HfDiffusionGemmaProvider extends BaseModelProvider implements ModelTraceProviderStrategy {
  readonly id = 'hf-diffusiongemma' as const;
  readonly label = 'HF Transformers DiffusionGemma';
  readonly kind = 'local-worker' as const;

  constructor(private readonly workerProvider: WorkerTraceProvider = requestHfDiffusionGemmaTrace) {
    super();
  }

  supports(request: RefineRequest): boolean {
    return request.outputType === 'story';
  }

  async isAvailable(): Promise<ProviderAvailability> {
    if (this.workerProvider !== requestHfDiffusionGemmaTrace) {
      return this.updateAvailability({
        configured: true,
        available: true,
        reason: 'Custom worker provider configured.'
      });
    }

    const pythonPath = process.env.DIFFUSIONGEMMA_PYTHON ?? defaultDiffusionGemmaPythonPath();
    if (!existsSync(pythonPath)) {
      return this.updateAvailability({
        configured: true,
        available: false,
        reason: `Python worker executable was not found at ${pythonPath}.`
      });
    }

    return this.updateAvailability({
      configured: true,
      available: true,
      reason: 'Python worker executable is present; Transformers model will be loaded lazily.'
    });
  }

  async refine(request: RefineRequest, seedTrace: Trace, timeoutMs: number): Promise<Trace | null> {
    return this.workerProvider(request, seedTrace, timeoutMs);
  }
}
