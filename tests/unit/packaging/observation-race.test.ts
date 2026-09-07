import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';

it.skipIf(process.platform !== 'win32')(
  'installation observation tolerates a vanished key but rejects denied reads',
  () => {
    const dir = mkdtempSync(join(tmpdir(), 'observe-race-'));
    try {
      const script = join(dir, 'probe.ps1');
      const observer = resolve('tests/acceptance/helpers/observe-installation.ps1').replaceAll(
        "'",
        "''",
      );
      for (const denied of [false, true]) {
        writeFileSync(
          script,
          `
function Test-Path { param($LiteralPath) return $LiteralPath -like 'HKCU:*' }
function Get-ChildItem { param($LiteralPath) return [pscustomobject]@{PSPath='HKCU:\\missing-observation-key';PSChildName='ThreadHelm';Name='ThreadHelm'} }
function Get-ItemProperty { param($LiteralPath) throw [${denied ? 'System.UnauthorizedAccessException' : 'System.Management.Automation.ItemNotFoundException'}]::new('injected read race') }
function Get-CimInstance { param($ClassName) return @() }
& '${observer}' -InstallRoot '${dir.replaceAll("'", "''")}' -AppGuid '00000000-0000-0000-0000-000000000001'
`,
        );
        const result = spawnSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-File', script], {
          encoding: 'utf8',
        });
        if (denied) expect(result.status).not.toBe(0);
        else {
          expect(result.status, result.stderr).toBe(0);
          expect(JSON.parse(result.stdout).registrations).toEqual([]);
        }
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  15000,
);
