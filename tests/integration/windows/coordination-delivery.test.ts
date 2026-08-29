/**
 * T018 — directed-delivery safety cases (Feature 002).
 *
 * These intentionally exercise the real Windows fixture app without provider
 * credentials. They remain RED until the coordination service and delivery
 * APIs are implemented.
 */

import { rmSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CoordinationHarness, type FixtureSessionRef } from './helpers/coordination-harness.js';
import {
  cleanupUserData,
  launchApp,
  launchIn,
  mkWorkspace,
  sessionOf,
  sleep,
  waitFor,
  type LaunchedApp,
} from './helpers/harness.js';

type LaunchedFixture = { session: FixtureSessionRef; workspaceId: string };

let app: LaunchedApp;
let coordination: CoordinationHarness;
const dirs: string[] = [];

beforeEach(async () => {
  app = await launchApp();
  await app.useFixtureAdapters({ 'codex-cli': 'echo', 'claude-code': 'echo' });
  coordination = new CoordinationHarness(app);
});

afterEach(async () => {
  await app.close();
  cleanupUserData(app.userData);
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

async function fixture(
  providerId: 'codex-cli' | 'claude-code',
  tag: string,
): Promise<LaunchedFixture> {
  const dir = mkWorkspace(tag);
  dirs.push(dir);
  const launched = await launchIn(app, dir, providerId);
  const session: FixtureSessionRef = {
    id: launched.session.id,
    providerId,
    workspaceId: launched.ws.id,
  };
  coordination.registerSession(session);
  return { session, workspaceId: launched.ws.id };
}

async function preview(sender: LaunchedFixture, recipient: LaunchedFixture) {
  const reviewed = await app.call<{
    previewToken: string;
    recipientSessionId: string;
  }>('coordination.previewHandoff', {
    sourceSessionId: sender.session.id,
    recipientSessionId: recipient.session.id,
    kind: 'request',
    purpose: 'fixture delivery',
    body: 'bounded fixture work',
    responseExpected: true,
  });
  const persisted = await app.call<{ id: string; recipientSessionId: string }>(
    'coordination.confirmHandoff',
    { previewToken: reviewed.previewToken, persistenceConfirmation: true },
  );
  return { ...reviewed, handoffId: persisted.id, recipientSessionId: persisted.recipientSessionId };
}

describe('coordination delivery safety', () => {
  it('delivers only to the selected recipient terminal', async () => {
    const sender = await fixture('codex-cli', 'sender');
    const recipient = await fixture('claude-code', 'recipient');
    const handoff = await preview(sender, recipient);

    await app.call('sessions.select', { sessionId: sender.session.id });
    const rejected = await app.dispatch('coordination.requestPresentation', {
      handoffId: handoff.handoffId,
    });

    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.error.code).toBe('COORDINATION_TARGET_NOT_SELECTED');
  });

  it('keeps handoff, user input, resize, interrupt, and stop in one control order', async () => {
    const sender = await fixture('codex-cli', 'order-sender');
    const recipient = await fixture('claude-code', 'order-recipient');
    const handoff = await preview(sender, recipient);
    await app.call('sessions.select', { sessionId: recipient.session.id });
    const disclosure = await app.call<{ presentationToken: string }>(
      'coordination.requestPresentation',
      { handoffId: handoff.handoffId },
    );
    const applied = await app.call<{ controlSequence: number }>(
      'coordination.confirmPresentation',
      {
        presentationToken: disclosure.presentationToken,
        submitConfirmation: true,
      },
    );
    const input = await app.call<{ controlSequence: number }>('sessions.sendInput', {
      sessionId: recipient.session.id,
      bytes: Uint8Array.from(Buffer.from('after-handoff\r', 'utf8')),
    });
    const resized = await app.call<{ controlSequence: number }>('sessions.resize', {
      sessionId: recipient.session.id,
      columns: 101,
      rows: 31,
    });
    const interrupted = await app.call<{ controlSequence: number }>('sessions.interrupt', {
      sessionId: recipient.session.id,
    });
    await waitFor(
      () => sessionOf(app, recipient.session.id),
      (session) => session.lifecycleState === 'running',
      10_000,
    );
    const stop = await app.call<{ stopToken: string }>('sessions.requestStop', {
      sessionId: recipient.session.id,
    });
    const stopped = await app.call<{ controlSequence: number }>('sessions.confirmStop', {
      stopToken: stop.stopToken,
    });

    expect(input.controlSequence).toBeGreaterThan(applied.controlSequence);
    expect(resized.controlSequence).toBeGreaterThan(input.controlSequence);
    expect(interrupted.controlSequence).toBeGreaterThan(resized.controlSequence);
    expect(stopped.controlSequence).toBeGreaterThan(interrupted.controlSequence);
  });

  it('maps duplicate acknowledgement/application to one logical delivery', async () => {
    const sender = await fixture('codex-cli', 'duplicate-sender');
    const recipient = await fixture('claude-code', 'duplicate-recipient');
    const handoff = await preview(sender, recipient);
    await app.call('sessions.select', { sessionId: recipient.session.id });
    const disclosure = await app.call<{ presentationToken: string }>(
      'coordination.requestPresentation',
      { handoffId: handoff.handoffId },
    );
    await app.call('coordination.confirmPresentation', {
      presentationToken: disclosure.presentationToken,
      submitConfirmation: true,
    });

    const duplicate = await app.dispatch('coordination.confirmPresentation', {
      presentationToken: disclosure.presentationToken,
      submitConfirmation: true,
    });
    expect(duplicate.ok).toBe(false);
  });

  it('records a pre-write failure without claiming delivery', async () => {
    const sender = await fixture('codex-cli', 'prewrite-sender');
    const recipient = await fixture('claude-code', 'prewrite-recipient');
    const handoff = await preview(sender, recipient);
    await app.call('sessions.select', { sessionId: recipient.session.id });
    const disclosure = await app.call<{ presentationToken: string }>(
      'coordination.requestPresentation',
      { handoffId: handoff.handoffId },
    );
    await app.failNextHostInput();
    const result = await app.call<{ state: string }>('coordination.confirmPresentation', {
      presentationToken: disclosure.presentationToken,
      submitConfirmation: true,
    });

    expect(result.state).toBe('failed_before_write');
    const database = new Database(join(app.userData, 'threadhelm.sqlite'), {
      readonly: true,
      fileMustExist: true,
    });
    try {
      expect(
        database
          .prepare('SELECT delivery_state FROM coordination_handoffs WHERE id = ?')
          .get(handoff.handoffId),
      ).toEqual({ delivery_state: 'manual_actionable' });
    } finally {
      database.close();
    }
  });

  it('does not resolve an ambiguous post-write boundary as delivered', async () => {
    const sender = await fixture('codex-cli', 'ambiguous-sender');
    const recipient = await fixture('claude-code', 'ambiguous-recipient');
    const handoff = await preview(sender, recipient);
    await app.call('sessions.select', { sessionId: recipient.session.id });
    const disclosure = await app.call<{ presentationToken: string }>(
      'coordination.requestPresentation',
      { handoffId: handoff.handoffId },
    );
    await app.delayNextControlApplied(5_000);
    const confirmation = app.dispatch('coordination.confirmPresentation', {
      presentationToken: disclosure.presentationToken,
      submitConfirmation: true,
    });
    void confirmation.catch(() => undefined);
    const databasePath = join(app.userData, 'threadhelm.sqlite');
    await waitFor(
      async () => {
        const database = new Database(databasePath, { readonly: true, fileMustExist: true });
        try {
          return database
            .prepare(
              'SELECT state FROM coordination_delivery_attempts WHERE handoff_id = ? ORDER BY attempt_number DESC LIMIT 1',
            )
            .get(handoff.handoffId) as { state: string } | undefined;
        } finally {
          database.close();
        }
      },
      (row) => row?.state === 'dispatching',
      10_000,
    );
    const userData = app.userData;
    await coordination.crashBoundary();
    await sleep(100);
    app = await launchApp({ userData });
    coordination = new CoordinationHarness(app);
    const recovered = new Database(databasePath, { readonly: true, fileMustExist: true });
    try {
      expect(
        recovered
          .prepare(
            'SELECT state FROM coordination_delivery_attempts WHERE handoff_id = ? ORDER BY attempt_number DESC LIMIT 1',
          )
          .get(handoff.handoffId),
      ).toEqual({ state: 'unknown' });
      expect(
        recovered
          .prepare('SELECT delivery_state FROM coordination_handoffs WHERE id = ?')
          .get(handoff.handoffId),
      ).toEqual({ delivery_state: 'manual_actionable' });
    } finally {
      recovered.close();
    }
  });

  it('marks dispatch unknown when only the recipient session fails before acknowledgement', async () => {
    const sender = await fixture('codex-cli', 'recipient-failure-sender');
    const recipient = await fixture('claude-code', 'recipient-failure-recipient');
    const handoff = await preview(sender, recipient);
    await app.call('sessions.select', { sessionId: recipient.session.id });
    const disclosure = await app.call<{ presentationToken: string }>(
      'coordination.requestPresentation',
      { handoffId: handoff.handoffId },
    );
    await app.delayNextControlApplied(5_000);
    const confirmation = app.call<{ state: string }>('coordination.confirmPresentation', {
      presentationToken: disclosure.presentationToken,
      submitConfirmation: true,
    });
    const databasePath = join(app.userData, 'threadhelm.sqlite');
    await waitFor(
      async () => {
        const database = new Database(databasePath, { readonly: true, fileMustExist: true });
        try {
          return database
            .prepare(
              'SELECT state FROM coordination_delivery_attempts WHERE handoff_id = ? ORDER BY attempt_number DESC LIMIT 1',
            )
            .get(handoff.handoffId) as { state: string } | undefined;
        } finally {
          database.close();
        }
      },
      (row) => row?.state === 'dispatching',
      10_000,
    );

    await app.failSession(recipient.session.id);
    expect(await confirmation).toMatchObject({ state: 'unknown' });

    const database = new Database(databasePath, { readonly: true, fileMustExist: true });
    try {
      expect(
        database
          .prepare('SELECT delivery_state FROM coordination_handoffs WHERE id = ?')
          .get(handoff.handoffId),
      ).toEqual({ delivery_state: 'manual_actionable' });
    } finally {
      database.close();
    }
  });

  it('leaves an unrelated session unchanged during delivery failure', async () => {
    const sender = await fixture('codex-cli', 'isolated-sender');
    const recipient = await fixture('claude-code', 'isolated-recipient');
    const unrelated = await fixture('codex-cli', 'isolated-unrelated');
    const before = await sessionOf(app, unrelated.session.id);
    const handoff = await preview(sender, recipient);

    await app.call('sessions.select', { sessionId: recipient.session.id });
    const disclosure = await app.call<{ presentationToken: string }>(
      'coordination.requestPresentation',
      { handoffId: handoff.handoffId },
    );
    await app.failNextHostInput();
    const failed = await app.call<{ state: string }>('coordination.confirmPresentation', {
      presentationToken: disclosure.presentationToken,
      submitConfirmation: true,
    });

    expect(failed.state).toBe('failed_before_write');
    expect(await sessionOf(app, unrelated.session.id)).toEqual(before);
  });
});
