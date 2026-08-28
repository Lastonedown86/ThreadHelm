/** T030 — workspaces.choose/approve/list/revoke and router boundary rules. */

import { ApprovedWorkspaceView, WorkspaceCandidateView } from '@threadhelm/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createWorld,
  errorCode,
  eventsNamed,
  FRAME_URL,
  identity,
  type FakeWorld,
} from './helpers/fake-context.js';

const DIR = 'C:\\projects\\alpha';

let world: FakeWorld;
beforeEach(() => {
  world = createWorld();
  world.addDir(DIR, identity(1));
});

describe('workspaces.choose', () => {
  it('returns a schema-valid candidate for a picked folder', async () => {
    world.pickerPath = DIR;
    const result = await world.call('workspaces.choose');
    expect(result.ok).toBe(true);
    const view = WorkspaceCandidateView.parse((result as { value: unknown }).value);
    expect(view.selectedPath).toBe(DIR);
    expect(view.canonicalPath.startsWith('\\\\?\\')).toBe(true);
    expect(view.identity).toEqual(identity(1));
    expect(view.existingWorkspaceId).toBeNull();
    expect(view.driveType).toBe('fixed_local');
  });

  it('SELECTION_CANCELLED when the picker returns nothing', async () => {
    world.pickerPath = null;
    expect(errorCode(await world.call('workspaces.choose'))).toBe('SELECTION_CANCELLED');
  });

  it.each([
    ['DIRECTORY_UNSUPPORTED', 'WORKSPACE_UNSUPPORTED'],
    ['DIRECTORY_NOT_FOUND', 'WORKSPACE_NOT_FOUND'],
    ['DIRECTORY_ACCESS_DENIED', 'WORKSPACE_NOT_FOUND'],
    ['DIRECTORY_AMBIGUOUS', 'WORKSPACE_AMBIGUOUS'],
  ])('maps native %s to %s', async (native, code) => {
    world.addDir('C:\\bad', { ...identity(9), error: native });
    world.pickerPath = 'C:\\bad';
    expect(errorCode(await world.call('workspaces.choose'))).toBe(code);
  });

  it('reports an existing approval covering the same effective folder', async () => {
    const approved = await world.approve(DIR);
    world.addDir('C:\\projects\\ALPHA\\', identity(1));
    world.pickerPath = 'C:\\projects\\ALPHA\\';
    const candidate = await world.ok<{ existingWorkspaceId: string }>('workspaces.choose');
    expect(candidate.existingWorkspaceId).toBe(approved.id);
  });
});

describe('workspaces.approve', () => {
  it('consumes the candidate token once', async () => {
    world.pickerPath = DIR;
    const { candidateToken } = await world.ok<{ candidateToken: string }>('workspaces.choose');
    const first = await world.call('workspaces.approve', { candidateToken });
    expect(first.ok).toBe(true);
    expect(errorCode(await world.call('workspaces.approve', { candidateToken }))).toBe(
      'CANDIDATE_EXPIRED',
    );
  });

  it('CANDIDATE_EXPIRED after the token TTL', async () => {
    world.pickerPath = DIR;
    const { candidateToken } = await world.ok<{ candidateToken: string }>('workspaces.choose');
    world.clock.now += 61_000;
    expect(errorCode(await world.call('workspaces.approve', { candidateToken }))).toBe(
      'CANDIDATE_EXPIRED',
    );
  });

  it('WORKSPACE_CHANGED when identity differs between choose and approve', async () => {
    world.pickerPath = DIR;
    const { candidateToken } = await world.ok<{ candidateToken: string }>('workspaces.choose');
    world.addDir(DIR, identity(2)); // directory replaced under the same path
    const result = await world.call('workspaces.approve', { candidateToken });
    expect(errorCode(result)).toBe('WORKSPACE_CHANGED');
  });

  it('two spellings of one effective folder share one approval', async () => {
    const a = await world.approve(DIR);
    world.addDir('C:\\PROJECTS\\alpha\\.\\', identity(1));
    const b = await world.approve('C:\\PROJECTS\\alpha\\.\\');
    expect(b.id).toBe(a.id);
    expect(await world.ok<unknown[]>('workspaces.list')).toHaveLength(1);
    expect(eventsNamed(world, 'workspace.changed')).toHaveLength(1);
  });

  it('returns exactly the contract view (no extra fields)', async () => {
    const view = await world.approve(DIR);
    expect(ApprovedWorkspaceView.strict().parse(view)).toEqual(view);
  });

  it('rejects unknown tokens', async () => {
    expect(
      errorCode(await world.call('workspaces.approve', { candidateToken: 'x'.repeat(24) })),
    ).toBe('CANDIDATE_EXPIRED');
  });
});

describe('workspaces.revoke', () => {
  it('WORKSPACE_NOT_FOUND for unknown ids', async () => {
    expect(
      errorCode(
        await world.call('workspaces.revoke', {
          workspaceId: '11111111-1111-4111-8111-111111111111',
        }),
      ),
    ).toBe('WORKSPACE_NOT_FOUND');
  });

  it('WORKSPACE_ACTIVE while a live session uses it, then succeeds', async () => {
    const workspace = await world.approve(DIR);
    const session = await world.launch(workspace.id);
    expect(world.ctx.live.has(session.id)).toBe(true);
    const blocked = await world.call('workspaces.revoke', { workspaceId: workspace.id });
    expect(errorCode(blocked)).toBe('WORKSPACE_ACTIVE');

    const stop = await world.ok<{ stopToken: string }>('sessions.requestStop', {
      sessionId: session.id,
    });
    await world.ok('sessions.confirmStop', { stopToken: stop.stopToken });
    await world.until(() => !world.ctx.live.has(session.id));

    world.events.length = 0;
    const revoked = await world.ok<{ revokedAt: string | null }>('workspaces.revoke', {
      workspaceId: workspace.id,
    });
    expect(revoked.revokedAt).not.toBeNull();
    expect(eventsNamed(world, 'workspace.changed')).toHaveLength(1);
    // A revoked approval cannot host a new launch.
    expect(
      errorCode(
        await world.call('sessions.previewLaunch', {
          workspaceId: workspace.id,
          providerId: 'codex-cli',
          terminal: { columns: 80, rows: 24 },
        }),
      ),
    ).toBe('WORKSPACE_CHANGED');
  });
});

describe('router boundary', () => {
  it('rejects unknown operations', async () => {
    expect(
      errorCode(
        await world.router.dispatch('fs.readFile', {}, { frameUrl: FRAME_URL, isMainFrame: true }),
      ),
    ).toBe('INVALID_REQUEST');
  });

  it('rejects senders that are not the app main frame', async () => {
    expect(
      errorCode(
        await world.router.dispatch('workspaces.list', undefined, {
          frameUrl: FRAME_URL,
          isMainFrame: false,
        }),
      ),
    ).toBe('UNAUTHORIZED_SENDER');
    expect(
      errorCode(
        await world.router.dispatch('workspaces.list', undefined, {
          frameUrl: 'https://evil.example/',
          isMainFrame: true,
        }),
      ),
    ).toBe('UNAUTHORIZED_SENDER');
  });

  it('rejects malformed payloads and never echoes them', async () => {
    const result = await world.call('workspaces.revoke', { workspaceId: 'not-a-uuid' });
    expect(errorCode(result)).toBe('INVALID_REQUEST');
    expect(JSON.stringify(result)).not.toContain('not-a-uuid');
    expect(errorCode(await world.call('workspaces.approve', 'C:\\evil'))).toBe('INVALID_REQUEST');
  });

  it('STORAGE_UNAVAILABLE without storage', async () => {
    const dark = createWorld({ noStorage: true });
    expect(errorCode(await dark.call('workspaces.list'))).toBe('STORAGE_UNAVAILABLE');
  });
});
