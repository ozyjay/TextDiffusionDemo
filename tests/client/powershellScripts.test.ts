import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();
const openDayScript = resolve(projectRoot, 'scripts/pwsh/open-day.ps1');
const verifyScript = resolve(projectRoot, 'scripts/pwsh/verify.ps1');

describe('PowerShell workflows', () => {
  it('passes Open Day preflight when the configured ModelDeck route is ready', () => {
    const command = [
      'function global:Invoke-RestMethod {',
      'param($Uri)',
      'if ($Uri -like "*/v1/health") { return [pscustomobject]@{ ok = $true } }',
      'return [pscustomobject]@{ data = @([pscustomobject]@{ id = "text-diffusion-lab-q4"; ready = $true; state = "running" }) }',
      '}',
      `& '${escapePowerShell(openDayScript)}' -PreflightOnly`
    ].join(' ');

    const result = spawnSync('pwsh', ['-NoProfile', '-Command', command], { encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('ModelDeck preflight OK: route "text-diffusion-lab-q4" is ready.');
    expect(result.stdout).toContain('Open Day preflight complete.');
  });

  it('continues Open Day preflight with safe fallback when ModelDeck is unavailable', () => {
    const command = [
      'function global:Invoke-RestMethod { throw "private connection detail" }',
      `& '${escapePowerShell(openDayScript)}' -PreflightOnly`
    ].join(' ');

    const result = spawnSync('pwsh', ['-NoProfile', '-Command', command], { encoding: 'utf8' });
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(0);
    expect(output).toContain('Model-assisted mode will use the safe fallback');
    expect(output).toContain('Open Day preflight complete with safe model fallback.');
    expect(output).not.toContain('private connection detail');
  });

  it('stops verification immediately after a failed npm test command', () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'text-diffusion-verify-'));
    const fakeNpm = join(temporaryDirectory, 'npm');
    const logPath = join(temporaryDirectory, 'calls.log');
    writeFileSync(fakeNpm, '#!/bin/sh\nprintf "%s\\n" "$*" >> "$VERIFY_TEST_LOG"\nexit 9\n');
    chmodSync(fakeNpm, 0o755);

    try {
      const result = spawnSync('pwsh', ['-NoProfile', '-File', verifyScript], {
        cwd: projectRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${temporaryDirectory}:${process.env.PATH ?? ''}`,
          VERIFY_TEST_LOG: logPath
        }
      });
      const output = `${result.stdout}\n${result.stderr}`;

      expect(result.status).not.toBe(0);
      expect(readFileSync(logPath, 'utf8').trim()).toBe('test');
      expect(output).not.toContain('Running production build');
      expect(output).not.toContain('Verification complete');
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});

function escapePowerShell(value: string): string {
  return value.replaceAll("'", "''");
}
