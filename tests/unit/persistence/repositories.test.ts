import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ThreadHelmError } from '@threadhelm/contracts';
import {
  createRepositories,
  migrate,
  openDatabase,
  type Db,
  type Repositories,
} from '@threadhelm/persistence';

let db: Db;
let repos: Repositories;
const NOW = '2026-08-28T12:00:00.000Z';
const SERIAL = '00000000deadbeef';
const FILE_ID = '0123456789abcdef0123456789abcdef';

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return (error as ThreadHelmError).code;
  }
  return 'no-throw';
};

beforeEach(() => {
  db = openDatabase(':memory:');
  migrate(db);
  repos = createRepositories(db);
  repos.definitions.upsertBuiltIn({
    id: 'claude-code',
    displayName: 'Claude Code',
    providerKind: 'claude-code',
    executableCandidates: ['claude.exe'],
    testedVersionRange: '>=1.0.0 <3.0.0',
    capabilities: {
      interactivePty: true,
      cleanStopStrategy: 'slash-exit',
      structuredActivity: false,
    },
  });
});

afterEach(() => db.close());

const approve = (selectedPath = 'C:\\Projects\\Alpha') =>
  repos.workspaces.insertApproval({
    selectedPath,
    displayPath: 'C:\\Projects\\Alpha',
    canonicalPath: '\\\\?\\C:\\Projects\\Alpha',
    volumeSerial: SERIAL,
    fileId: FILE_ID,
    approvedAt: NOW,
  });

const snapshot = () =>
  repos.readiness.insert({
    providerId: 'claude-code',
    resolvedExecutable: 'C:\\Users\\me\\AppData\\Local\\Programs\\claude\\claude.exe',
    version: '2.1.0',
    availability: 'available',
    authentication: 'authenticated',
    probedAt: NOW,
    reasonCode: null,
    safeSummary: 'Claude Code 2.1.0 ready',
  });

const startSession = () =>
  repos.sessions.insertStarting({
    workspaceId: approve().id,
    definitionId: 'claude-code',
    readinessSnapshotId: snapshot().id,
    columns: 120,
    rows: 40,
    createdAt: NOW,
  });

describe('workspaces', () => {
  it('rejects a second active approval for the same identity under a different spelling', () => {
    const first = approve('C:\\Projects\\Alpha');
    expect(first.driveType).toBe('fixed_local');
    expect(() => approve('C:\\PROJECTS\\alpha\\.')).toThrow(/UNIQUE/);
    expect(repos.workspaces.findActiveByIdentity(SERIAL, FILE_ID)?.id).toBe(first.id);
  });

  it('revokes and then allows re-approval', () => {
    const first = approve();
    const revoked = repos.workspaces.revoke(first.id, NOW);
    expect(revoked?.revokedAt).toBe(NOW);
    expect(repos.workspaces.listActive()).toHaveLength(0);
    expect(repos.workspaces.listAll()).toHaveLength(1);
    expect(approve().id).not.toBe(first.id);
  });
});

describe('readiness snapshots', () => {
  it('stores a sanitized snapshot without any raw output field', () => {
    const snap = snapshot();
    expect(repos.readiness.findById(snap.id)).toEqual(snap);
    expect(Object.keys(snap)).not.toContain('rawOutput');
    expect(
      code(() =>
        repos.readiness.insert({
          providerId: 'claude-code',
          resolvedExecutable: null,
          version: null,
          availability: 'error',
          authentication: 'unknown',
          probedAt: NOW,
          reasonCode: 'PROBE_FAILED',
          safeSummary: 'stderr: \x1b[31mboom',
        }),
      ),
    ).toBe('INVALID_REQUEST');
  });
});

describe('sessions and events', () => {
  it('starts as starting/unknown and patches fields', () => {
    const session = startSession();
    expect(session.lifecycleState).toBe('starting');
    expect(session.activityState).toBe('unknown');
    expect(repos.sessions.listUnfinished().map((s) => s.id)).toEqual([session.id]);

    const updated = repos.sessions.update(
      session.id,
      { lifecycleState: 'stopped', exitCode: 0, stopKind: 'clean', endedAt: NOW },
      NOW,
    );
    expect(updated.lifecycleState).toBe('stopped');
    expect(updated.exitCode).toBe(0);
    expect(repos.sessions.listUnfinished()).toHaveLength(0);
    expect(repos.sessions.list({ limit: 10 })).toHaveLength(1);
  });

  it('appends strictly increasing sequences and rolls back with the transaction', () => {
    const session = startSession();
    const event = (summary = 'Launch of Claude Code requested') =>
      repos.events.append(session.id, {
        kind: 'launch_requested',
        fromState: null,
        toState: 'starting',
        actor: 'user',
        reasonCode: null,
        safeSummary: summary,
        occurredAt: NOW,
      });
    expect(event().sequence).toBe(1);
    expect(event().sequence).toBe(2);

    expect(() =>
      repos.transaction(() => {
        repos.sessions.update(session.id, { lifecycleState: 'running' }, NOW);
        event();
        throw new Error('abort');
      }),
    ).toThrow('abort');
    expect(repos.sessions.findById(session.id)?.lifecycleState).toBe('starting');
    expect(repos.events.listBySession(session.id).map((e) => e.sequence)).toEqual([1, 2]);
  });

  it('refuses raw content in summaries', () => {
    const session = startSession();
    for (const bad of ['\x1b[31m red', 'key sk-abcdefghijkl']) {
      expect(
        code(() =>
          repos.events.append(session.id, {
            kind: 'state_changed',
            fromState: 'starting',
            toState: 'running',
            actor: 'provider',
            reasonCode: null,
            safeSummary: bad,
            occurredAt: NOW,
          }),
        ),
      ).toBe('INVALID_REQUEST');
    }
    expect(repos.events.listBySession(session.id)).toHaveLength(0);
  });
});

describe('recovery records', () => {
  it('allows one unresolved record per session and resolves exactly once', () => {
    const session = startSession();
    const record = repos.recovery.create({
      sessionId: session.id,
      lastKnownState: 'running',
      classification: 'unexpected_shutdown',
      reasonCode: 'COORDINATOR_EXIT',
      safeSummary: 'ThreadHelm closed while the session was running',
      createdAt: NOW,
    });
    expect(() =>
      repos.recovery.create({ ...record, reasonCode: 'X', safeSummary: 'dup', createdAt: NOW }),
    ).toThrow(/UNIQUE/);
    expect(repos.recovery.findUnresolvedBySession(session.id)?.id).toBe(record.id);

    const resolved = repos.recovery.resolve(record.id, 'dismissed', NOW);
    expect(resolved.resolution).toBe('dismissed');
    expect(resolved.resolvedAt).toBe(NOW);
    expect(repos.recovery.listUnresolved()).toHaveLength(0);
    expect(code(() => repos.recovery.resolve(record.id, 'dismissed', NOW))).toBe(
      'INVALID_RESOLUTION',
    );
    expect(
      code(() => repos.recovery.resolve('00000000-0000-4000-8000-000000000000', 'dismissed', NOW)),
    ).toBe('RECORD_NOT_FOUND');
  });
});
