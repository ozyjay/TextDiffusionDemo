import type { ModelRuntimeState, ModelRuntimeStatus } from '../../shared/types';

let status: ModelRuntimeStatus = {
  state: 'fallback',
  message: 'Model preload has not started.',
  updatedAt: new Date().toISOString(),
  preloadEnabled: false,
  progress: {
    percent: 0,
    label: 'Using scripted fallback.'
  }
};
let loadingStartedAtMs: number | null = null;
let loadingTimeoutMs: number | null = null;

export function getModelRuntimeStatus(): ModelRuntimeStatus {
  if (status.state !== 'loading' || loadingStartedAtMs === null) {
    return { ...status };
  }

  const elapsedMs = Math.max(0, Date.now() - loadingStartedAtMs);
  const timeoutMs = loadingTimeoutMs ?? 0;
  const estimatedPercent = timeoutMs > 0
    ? Math.min(95, Math.max(5, Math.round((elapsedMs / timeoutMs) * 95)))
    : 15;
  const elapsedSeconds = Math.round(elapsedMs / 1000);
  const timeoutSeconds = timeoutMs > 0 ? Math.round(timeoutMs / 1000) : undefined;

  return {
    ...status,
    progress: {
      percent: estimatedPercent,
      elapsedSeconds,
      timeoutSeconds,
      indeterminate: timeoutMs <= 0,
      label: timeoutSeconds
        ? `Estimated preload progress: ${estimatedPercent}% after ${elapsedSeconds}s of ${timeoutSeconds}s timeout.`
        : `Model preload has been running for ${elapsedSeconds}s.`
    }
  };
}

export function setModelRuntimeStatus(update: {
  state: ModelRuntimeState;
  message: string;
  providerId?: string;
  preloadEnabled?: boolean;
  loadingTimeoutMs?: number;
}): ModelRuntimeStatus {
  if (update.state === 'loading') {
    loadingStartedAtMs = Date.now();
    loadingTimeoutMs = update.loadingTimeoutMs ?? null;
  } else {
    loadingStartedAtMs = null;
    loadingTimeoutMs = null;
  }

  status = {
    state: update.state,
    providerId: update.providerId,
    message: update.message,
    preloadEnabled: update.preloadEnabled ?? status.preloadEnabled,
    updatedAt: new Date().toISOString(),
    progress: progressForState(update.state)
  };
  return getModelRuntimeStatus();
}

function progressForState(state: ModelRuntimeState): ModelRuntimeStatus['progress'] {
  if (state === 'ready') {
    return {
      percent: 100,
      label: 'Model preload complete.'
    };
  }

  if (state === 'error') {
    return {
      percent: 0,
      label: 'Model preload did not complete.'
    };
  }

  if (state === 'fallback') {
    return {
      percent: 0,
      label: 'Using scripted fallback.'
    };
  }

  return {
    percent: 5,
    elapsedSeconds: 0,
    timeoutSeconds: loadingTimeoutMs ? Math.round(loadingTimeoutMs / 1000) : undefined,
    indeterminate: !loadingTimeoutMs,
    label: 'Starting local model preload.'
  };
}
