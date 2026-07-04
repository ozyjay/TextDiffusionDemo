import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readProjectFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('launch scripts', () => {
  it('cleans reserved Unix ports before starting dev servers', () => {
    expect(readProjectFile('scripts/dev.sh')).toContain('./scripts/kill_reserved_ports.sh');
    expect(readProjectFile('scripts/open_day_mode.sh')).toContain('./scripts/kill_reserved_ports.sh');
  });

  it('keeps Unix port cleanup scoped to the reserved frontend and backend ports', () => {
    const helper = readProjectFile('scripts/kill_reserved_ports.sh');

    expect(helper).toContain('FRONTEND_PORT="${FRONTEND_PORT:-3300}"');
    expect(helper).toContain('BACKEND_PORT="${BACKEND_PORT:-8300}"');
    expect(helper).toContain('lsof -tiTCP:"$FRONTEND_PORT" -sTCP:LISTEN');
    expect(helper).toContain('lsof -tiTCP:"$BACKEND_PORT" -sTCP:LISTEN');
    expect(helper).toContain('pgrep -f "tsx watch server/index.ts"');
    expect(helper).toContain('pgrep -f "vite --strictPort"');
    expect(helper).toContain('wait_for_ports');
  });

  it('cleans reserved PowerShell ports before starting dev servers', () => {
    const cleanup = readProjectFile('scripts/pwsh/stop-reserved-ports.ps1');
    const smoke = readProjectFile('scripts/pwsh/smoke.ps1');

    expect(readProjectFile('scripts/pwsh/dev.ps1')).toContain('stop-reserved-ports.ps1');
    expect(readProjectFile('scripts/pwsh/open-day.ps1')).toContain('stop-reserved-ports.ps1');
    expect(cleanup).toContain('Stop-MatchingProcess -Pattern "tsx watch server/index.ts"');
    expect(cleanup).toContain('Stop-MatchingProcess -Pattern "vite --strictPort"');
    expect(cleanup).toContain('Get-Command Get-NetTCPConnection');
    expect(cleanup).toContain('lsof -tiTCP:$Port -sTCP:LISTEN');
    expect(smoke).toContain('Get-Command Get-NetTCPConnection');
    expect(smoke).toContain('lsof -tiTCP:$Port -sTCP:LISTEN');
  });
});
