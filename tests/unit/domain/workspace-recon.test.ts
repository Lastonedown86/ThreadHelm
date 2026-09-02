/**
 * Workspace Recon domain policy: bounded collection, honest outcome
 * classification, and role assignment by filename.
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_RECON_FILES,
  classifyReconOutcome,
  reconRoleForBasename,
  selectReconFiles,
  type ReconRunFacts,
} from '@threadhelm/domain';

const FACTS: ReconRunFacts = {
  providerUnauthenticated: false,
  ownerStopped: false,
  tokenCapReached: false,
  filesWritten: 0,
  parsedCount: 0,
  rejectedCount: 0,
};

describe('selectReconFiles', () => {
  it('considers files in name order so a run is reproducible', () => {
    const selection = selectReconFiles([
      { name: 'c.agent.json', sizeBytes: 10 },
      { name: 'a.agent.json', sizeBytes: 10 },
      { name: 'b.agent.json', sizeBytes: 10 },
    ]);
    expect(selection.considered).toEqual(['a.agent.json', 'b.agent.json', 'c.agent.json']);
    expect(selection.ignoredForCount).toEqual([]);
    expect(selection.oversized).toEqual([]);
  });

  it('considers at most MAX_RECON_FILES and reports the rest as ignored', () => {
    const files = Array.from({ length: MAX_RECON_FILES + 3 }, (_, i) => ({
      name: `role-${String(i).padStart(2, '0')}.agent.json`,
      sizeBytes: 10,
    }));
    const selection = selectReconFiles(files);
    expect(selection.considered).toHaveLength(MAX_RECON_FILES);
    expect(selection.ignoredForCount).toHaveLength(3);
    expect(selection.considered).not.toContain('role-12.agent.json');
  });

  it('reports an oversized considered file instead of reading it', () => {
    const selection = selectReconFiles([
      { name: 'big.agent.json', sizeBytes: 65537 },
      { name: 'small.agent.json', sizeBytes: 65536 },
    ]);
    expect(selection.oversized).toEqual(['big.agent.json']);
    expect(selection.considered).toEqual(['big.agent.json', 'small.agent.json']);
  });
});

describe('classifyReconOutcome', () => {
  it('reports no_output when the session wrote nothing', () => {
    expect(classifyReconOutcome(FACTS)).toBe('no_output');
  });

  it('reports unparsable_output when files were written but none parsed', () => {
    expect(
      classifyReconOutcome({ ...FACTS, filesWritten: 3, parsedCount: 0, rejectedCount: 3 }),
    ).toBe('unparsable_output');
  });

  it('reports partial when some parsed and some did not', () => {
    expect(
      classifyReconOutcome({ ...FACTS, filesWritten: 4, parsedCount: 3, rejectedCount: 1 }),
    ).toBe('partial');
  });

  it('reports completed only when every considered file parsed', () => {
    expect(
      classifyReconOutcome({ ...FACTS, filesWritten: 3, parsedCount: 3, rejectedCount: 0 }),
    ).toBe('completed');
  });

  it.each([
    [
      { providerUnauthenticated: true, ownerStopped: true, tokenCapReached: true },
      'provider_unauthenticated',
    ],
    [{ ownerStopped: true, tokenCapReached: true }, 'stopped_by_owner'],
    [{ tokenCapReached: true }, 'token_cap_reached'],
  ] as const)('prefers the run-level explanation %#', (overrides, expected) => {
    expect(classifyReconOutcome({ ...FACTS, ...overrides, filesWritten: 2, parsedCount: 2 })).toBe(
      expected,
    );
  });
});

describe('reconRoleForBasename', () => {
  it('treats exactly supervisor.agent.json as the supervisor', () => {
    expect(reconRoleForBasename('supervisor.agent.json')).toBe('supervisor');
    expect(reconRoleForBasename('SUPERVISOR.AGENT.JSON')).toBe('supervisor');
  });

  it('treats every other name as a specialist', () => {
    expect(reconRoleForBasename('rust-native.agent.json')).toBe('specialist');
    expect(reconRoleForBasename('supervisor-notes.agent.json')).toBe('specialist');
  });
});
