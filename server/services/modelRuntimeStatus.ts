import type { ModelRuntimeState, ModelRuntimeStatus } from '../../shared/types';

let status: ModelRuntimeStatus = {
  state: 'fallback',
  message: 'Model preload has not started.',
  updatedAt: new Date().toISOString(),
  preloadEnabled: false
};

export function getModelRuntimeStatus(): ModelRuntimeStatus {
  return { ...status };
}

export function setModelRuntimeStatus(update: {
  state: ModelRuntimeState;
  message: string;
  providerId?: string;
  preloadEnabled?: boolean;
}): ModelRuntimeStatus {
  status = {
    state: update.state,
    providerId: update.providerId,
    message: update.message,
    preloadEnabled: update.preloadEnabled ?? status.preloadEnabled,
    updatedAt: new Date().toISOString()
  };
  return getModelRuntimeStatus();
}
