import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadDotEnv } from '../../server/env';

const touchedKeys = ['TEXT_DIFFUSION_ENV_TEST', 'TEXT_DIFFUSION_ENV_EXISTING'];

describe('environment loader', () => {
  afterEach(() => {
    for (const key of touchedKeys) {
      delete process.env[key];
    }
  });

  it('loads simple .env values without overriding existing environment variables', () => {
    const dir = mkdtempSync(join(tmpdir(), 'text-diffusion-env-'));
    const envPath = join(dir, '.env');
    process.env.TEXT_DIFFUSION_ENV_EXISTING = 'from-shell';

    writeFileSync(envPath, [
      '# local development values',
      'TEXT_DIFFUSION_ENV_TEST="from file"',
      'TEXT_DIFFUSION_ENV_EXISTING=from-file'
    ].join('\n'));

    try {
      loadDotEnv(envPath);
      expect(process.env.TEXT_DIFFUSION_ENV_TEST).toBe('from file');
      expect(process.env.TEXT_DIFFUSION_ENV_EXISTING).toBe('from-shell');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
