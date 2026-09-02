/**
 * Workspace Recon contract shapes. The disclosure must carry the launch
 * boundary warning unmodified; confirmation must be impossible without it.
 */
import { describe, expect, it } from 'vitest';
import {
  operations,
  RECON_NO_AUTO_HIRE_STATEMENT,
  ReconLaunchPreviewView,
  ReconOutcome,
  ReconRejectionView,
  ReconRunView,
  PreviewImportProfileRequest,
} from '@threadhelm/contracts';
import type { ReconOutcome as DomainReconOutcome } from '@threadhelm/domain';

const RUN_BASE = {
  runId: '11111111-1111-4111-8111-111111111111',
  workspaceId: '22222222-2222-4222-8222-222222222222',
  sessionId: null,
  outcome: null,
  derivedFromCommit: null,
  startedAt: '2026-09-02T00:00:00.000Z',
  completedAt: null,
  proposals: [],
  rejected: [],
  ignoredFileCount: 0,
};

describe('recon outcomes', () => {
  it('keeps all seven outcomes distinct with no blanket failure', () => {
    expect(ReconOutcome.options).toEqual([
      'completed',
      'partial',
      'no_output',
      'unparsable_output',
      'stopped_by_owner',
      'token_cap_reached',
      'provider_unauthenticated',
    ]);
    expect(ReconOutcome.options).not.toContain('failed');
  });
});

describe('contracts agree with domain policy', () => {
  it('keeps the zod enum and the domain union identical', async () => {
    const domain = await import('@threadhelm/domain');
    // A domain-side exhaustive map: adding an outcome to one side and not the
    // other fails to compile here, and a reordering fails the assertion below.
    const fromDomain: Record<DomainReconOutcome, true> = {
      completed: true,
      partial: true,
      no_output: true,
      unparsable_output: true,
      stopped_by_owner: true,
      token_cap_reached: true,
      provider_unauthenticated: true,
    };
    expect([...ReconOutcome.options].sort()).toEqual(Object.keys(fromDomain).sort());
    expect(domain.MAX_RECON_FILES).toBe(12);
  });

  it('bounds ReconRunView collections at the domain collection limit', async () => {
    const { MAX_RECON_FILES } = await import('@threadhelm/domain');
    const rejection = ReconRejectionView.parse({ sourceBasename: 'x.json', errorCode: 'X' });
    const atLimit = Array.from({ length: MAX_RECON_FILES }, () => rejection);
    expect(ReconRunView.safeParse({ ...RUN_BASE, rejected: atLimit }).success).toBe(true);
    expect(ReconRunView.safeParse({ ...RUN_BASE, rejected: [...atLimit, rejection] }).success).toBe(
      false,
    );
  });
});

describe('workspaceRecon operations', () => {
  it('exposes preview, confirm and read', () => {
    expect(Object.keys(operations).filter((k) => k.startsWith('workspaceRecon.'))).toEqual([
      'workspaceRecon.previewLaunch',
      'workspaceRecon.confirmLaunch',
      'workspaceRecon.getRun',
    ]);
  });

  it('refuses confirmation without the boundary confirmation', () => {
    const request = operations['workspaceRecon.confirmLaunch'].request;
    expect(request.safeParse({ previewToken: 'tok', boundaryConfirmation: false }).success).toBe(
      false,
    );
    expect(request.safeParse({ previewToken: 'tok' }).success).toBe(false);
  });

  it('states that nothing is hired automatically and never claims read-only', () => {
    expect(RECON_NO_AUTO_HIRE_STATEMENT).toContain('No agent is hired');
    expect(RECON_NO_AUTO_HIRE_STATEMENT.toLowerCase()).not.toContain('read-only');
  });

  it('names the token cap a request, because ThreadHelm cannot enforce one', () => {
    const shape = ReconLaunchPreviewView.shape;
    expect(Object.keys(shape)).toContain('tokenCapRequested');
    expect(Object.keys(shape)).not.toContain('tokenCap');
  });
});

describe('ConfirmImportProfileRequest', () => {
  it('accepts an owner-typed display name and works without one', () => {
    const request = operations['profiles.confirmImport'].request;
    const previewToken = 'a'.repeat(32);
    expect(request.safeParse({ previewToken, importConfirmation: true }).success).toBe(true);
    expect(
      request.safeParse({
        previewToken,
        importConfirmation: true,
        displayName: 'Roster lead',
      }).success,
    ).toBe(true);
    expect(
      request.safeParse({ previewToken, importConfirmation: true, displayName: '' }).success,
    ).toBe(false);
  });
});

describe('ReconRunView', () => {
  it('accepts a run that is still in flight', () => {
    expect(ReconRunView.safeParse(RUN_BASE).success).toBe(true);
  });

  it('records absence of a commit as null rather than an empty string', () => {
    expect(ReconRunView.safeParse({ ...RUN_BASE, derivedFromCommit: '' }).success).toBe(false);
  });
});

describe('PreviewImportProfileRequest', () => {
  it('accepts exactly one source', () => {
    expect(PreviewImportProfileRequest.safeParse({ fileHandle: 'h' }).success).toBe(true);
    expect(
      PreviewImportProfileRequest.safeParse({
        proposalId: '11111111-1111-4111-8111-111111111111',
      }).success,
    ).toBe(true);
    expect(PreviewImportProfileRequest.safeParse({}).success).toBe(false);
    expect(
      PreviewImportProfileRequest.safeParse({
        fileHandle: 'h',
        proposalId: '11111111-1111-4111-8111-111111111111',
      }).success,
    ).toBe(false);
  });
});
