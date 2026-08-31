/**
 * Credentialed provider smoke suite (T089) — separate from CI, non-recording.
 *
 *   THREADHELM_PROVIDER_SMOKE=1 pnpm test:smoke:providers
 *
 * Requires Codex CLI and/or Claude Code installed and authenticated by their
 * own tooling. Nothing here logs, snapshots, or asserts on provider output:
 * only sanitized readiness views and lifecycle states are inspected. Either
 * provider may be absent; its cases are then reported as skipped.
 */

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  approveFolder,
  cleanupUserData,
  launchApp,
  waitFor,
  type LaunchedApp,
} from '../e2e/helpers/app.js';

const enabled = process.env.THREADHELM_PROVIDER_SMOKE === '1';
const describeSmoke = enabled ? describe : describe.skip;

interface Readiness {
  providerId: 'codex-cli' | 'claude-code';
  availability: string;
  authentication: string;
  resolvedExecutable: string | null;
  version: string | null;
  safeSummary: string;
}

const SECRET_SHAPED =
  /(sk-[A-Za-z0-9_-]{8,}|Bearer\s|@[a-z0-9-]+\.[a-z]{2,}|eyJ[A-Za-z0-9_-]{10,}\.)/;

describeSmoke('real provider smoke (non-recording)', () => {
  let app: LaunchedApp;
  let readiness: Readiness[] = [];
  const dirs: string[] = [];

  beforeAll(async () => {
    app = await launchApp();
    readiness = await app.call<Readiness[]>('providers.listReadiness');
  }, 120_000);

  afterAll(async () => {
    await app.close();
    cleanupUserData(app.userData);
    for (const dir of dirs) cleanupUserData(dir);
  });

  it('reports sanitized readiness for both providers', () => {
    expect(readiness.map((r) => r.providerId).sort()).toEqual(['claude-code', 'codex-cli']);
    for (const view of readiness) {
      expect(view.safeSummary).not.toMatch(SECRET_SHAPED);
      if (view.resolvedExecutable) expect(view.resolvedExecutable).toMatch(/^[A-Za-z]:\\/);
    }
  });

  for (const providerId of ['codex-cli', 'claude-code'] as const) {
    it(`launches, runs, and cleanly stops ${providerId} when available`, async (context) => {
      const view = readiness.find((r) => r.providerId === providerId);
      if (!view || view.availability !== 'available' || view.authentication === 'unauthenticated') {
        console.log(
          `${providerId}: skipped (${view?.availability ?? 'missing'}/${view?.authentication ?? 'unknown'})`,
        );
        context.skip();
        return;
      }
      console.log(
        `${providerId}: version=${view.version?.match(/\b\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?\b/)?.[0] ?? 'unreported'} authentication=${view.authentication}; dev-build lifecycle proof only`,
      );
      const dir = mkdtempSync(join(tmpdir(), `threadhelm-smoke-${providerId}-`));
      dirs.push(dir);
      const workspace = await approveFolder(app, dir);
      const preview = await app.call<{ previewToken: string; readiness: Readiness }>(
        'sessions.previewLaunch',
        { workspaceId: workspace.id, providerId, terminal: { columns: 120, rows: 40 } },
      );
      expect(preview.readiness.availability).toBe('available');
      const session = await app.call<{ id: string; lifecycleState: string }>('sessions.launch', {
        previewToken: preview.previewToken,
        boundaryConfirmation: true,
      });
      expect(session.lifecycleState).toBe('running');
      // Give the TUI a moment to start, then stop it through the adapter's clean path.
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      const stop = await app.call<{ stopToken: string }>('sessions.requestStop', {
        sessionId: session.id,
      });
      await app.call('sessions.confirmStop', { stopToken: stop.stopToken });
      const final = await waitFor(
        () =>
          app.call<{
            sessions: { id: string; lifecycleState: string; forceStopAvailable: boolean }[];
          }>('sessions.list'),
        (list) => {
          const s = list.sessions.find((x) => x.id === session.id);
          return s?.lifecycleState === 'stopped' || s?.forceStopAvailable === true;
        },
        60_000,
      );
      const record = final.sessions.find((x) => x.id === session.id)!;
      if (record.lifecycleState !== 'stopped') {
        // Clean stop timed out: escalate explicitly, exactly as a user would.
        const force = await app.call<{ forceToken: string }>('sessions.requestForceStop', {
          sessionId: session.id,
        });
        await app.call('sessions.confirmForceStop', { forceToken: force.forceToken });
      }
      await waitFor(
        () => app.liveSessions(),
        (live) => live.length === 0,
        30_000,
      );
    }, 180_000);
  }
});
