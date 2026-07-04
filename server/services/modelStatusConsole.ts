import type { ProviderDiagnostics } from './modelProviders/types';

export interface ModelStatusEnvironment {
  modelId?: string;
  engine?: string;
}

export function formatModelStatusLines(
  diagnostics: ProviderDiagnostics,
  environment: ModelStatusEnvironment = {}
): string[] {
  const modelId = environment.modelId || 'not set';
  const engine = environment.engine || 'auto';
  const activeProvider = diagnostics.providers.find(
    (provider) => provider.available && provider.id !== 'fallback'
  );
  const fallback = diagnostics.providers.find((provider) => provider.id === 'fallback');
  const headline = activeProvider
    ? `live provider candidate via ${activeProvider.id}; model loads on first request`
    : fallback?.available
      ? 'fallback only; no live model provider is ready'
      : 'no model provider is ready';

  return [
    `[model] status: ${headline}`,
    `[model] configured model: ${modelId}`,
    `[model] engine: ${engine}; provider selection: ${diagnostics.providerSelection}`,
    ...diagnostics.providers.map((provider) => {
      const availability = provider.available ? 'available' : 'unavailable';
      const reason = provider.reason ? ` - ${provider.reason}` : '';
      return `[model] ${provider.id}: ${availability}${reason}`;
    })
  ];
}
