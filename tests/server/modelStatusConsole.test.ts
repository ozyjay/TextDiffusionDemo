import { describe, expect, it } from 'vitest';
import { formatModelStatusLines } from '../../server/services/modelStatusConsole';
import type { ProviderDiagnostics } from '../../server/services/modelProviders/types';

describe('model status console output', () => {
  it('summarises fallback-only status without exposing URLs', () => {
    const diagnostics: ProviderDiagnostics = {
      providerSelection: 'auto',
      providers: [
        {
          id: 'external-adapter',
          label: 'External model adapter',
          kind: 'external',
          configured: true,
          available: false,
          reason: 'fetch failed',
          lastOutcome: 'not-run'
        },
        {
          id: 'hf-diffusiongemma',
          label: 'HF Transformers DiffusionGemma',
          kind: 'local-worker',
          configured: true,
          available: false,
          reason: 'Python worker executable was not found at .venv-diffusiongemma/bin/python.',
          lastOutcome: 'not-run'
        },
        {
          id: 'fallback',
          label: 'Scripted fallback',
          kind: 'fallback',
          configured: true,
          available: true,
          reason: 'Always available through scripted/template traces.',
          lastOutcome: 'not-run'
        }
      ]
    };

    const lines = formatModelStatusLines(diagnostics, {
      modelId: 'google/diffusiongemma-26B-A4B-it',
      engine: 'auto'
    });

    expect(lines[0]).toBe('[model] status: fallback only; no live model provider is ready');
    expect(lines).toContain('[model] configured model: google/diffusiongemma-26B-A4B-it');
    expect(lines.join('\n')).toContain('hf-diffusiongemma: unavailable');
    expect(lines.join('\n')).not.toContain('http://secret-host.example');
  });
});
