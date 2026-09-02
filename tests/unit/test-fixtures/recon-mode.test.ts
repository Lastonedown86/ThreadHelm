/**
 * The recon fixture writes a deterministic proposal set outside any workspace.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RECON_PROPOSAL_FIXTURES, fakeAgentLaunch } from '@threadhelm/test-fixtures';
import { parseAgentManifest } from '@threadhelm/domain';

describe('fake agent recon mode', () => {
  it('writes exactly the fixture set into the directory it is given', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'recon-fixture-'));
    const { executable, args } = fakeAgentLaunch('recon', { outDir });
    execFileSync(executable, args, { encoding: 'utf8' });

    const written = readdirSync(outDir).sort();
    expect(written).toEqual(RECON_PROPOSAL_FIXTURES.map((f) => f.basename).sort());
    expect(written).toContain('supervisor.agent.json');
  });

  it('produces manifests that parse and carry a placeholder name', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'recon-fixture-'));
    const { executable, args } = fakeAgentLaunch('recon', { outDir });
    execFileSync(executable, args, { encoding: 'utf8' });

    const manifest = parseAgentManifest(
      readFileSync(join(outDir, 'supervisor.agent.json'), 'utf8'),
    );
    expect(manifest.name).toBe('Unnamed supervisor');
    expect(manifest.spec).toBe('threadhelm/agent-profile@1');
  });

  it('includes one malformed file so the rejection path is always exercised', () => {
    const malformed = RECON_PROPOSAL_FIXTURES.find((f) => f.basename.includes('malformed'));
    expect(malformed).toBeDefined();
    expect(() => parseAgentManifest(malformed!.text)).toThrow();
  });

  it('keeps the .cjs copy of the fixture set identical to the module copy', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'recon-fixture-'));
    const { executable, args } = fakeAgentLaunch('recon', { outDir });
    execFileSync(executable, args, { encoding: 'utf8' });
    for (const fixture of RECON_PROPOSAL_FIXTURES) {
      expect(readFileSync(join(outDir, fixture.basename), 'utf8')).toBe(fixture.text);
    }
  });
});
