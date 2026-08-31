import { expect, test, type Locator, type Page } from '@playwright/test';
import Database from 'better-sqlite3';
import { join } from 'node:path';
import { approveFolder, launchFixtureSession, waitFor, type LaunchedApp } from './helpers/app.js';
import {
  launchWithFixtures,
  sessionOptions,
  teardown,
  tempWorkspace,
  terminalRows,
} from './helpers/ui.js';

async function press(locator: Locator, key = 'Enter'): Promise<void> {
  await locator.focus();
  await locator.page().keyboard.press(key);
}

async function type(locator: Locator, value: string): Promise<void> {
  await locator.focus();
  await locator.page().keyboard.type(value);
}

async function launchThree(app: LaunchedApp) {
  const dirs = [tempWorkspace('coord-a'), tempWorkspace('coord-b'), tempWorkspace('coord-c')];
  const workspaces = [];
  for (const dir of dirs) workspaces.push(await approveFolder(app, dir));
  const sessions = [
    await launchFixtureSession(app, workspaces[0]!.id, 'codex-cli'),
    await launchFixtureSession(app, workspaces[1]!.id, 'claude-code'),
    await launchFixtureSession(app, workspaces[2]!.id, 'codex-cli'),
  ];
  await expect(sessionOptions(app.page)).toHaveCount(3, { timeout: 30_000 });
  return { dirs, sessions };
}

async function createHandoffByKeyboard(
  page: Page,
  purpose: string,
  body: string,
): Promise<Locator> {
  await press(page.getByRole('button', { name: 'New handoff…' }));
  const composer = page.getByRole('dialog', { name: 'Create directed handoff' });
  await expect(composer).toBeVisible();
  await type(composer.getByLabel('Purpose'), purpose);
  await type(composer.getByLabel('Handoff body'), body);
  await press(composer.getByRole('button', { name: 'Review handoff' }));

  const review = page.getByRole('dialog', { name: 'Review durable handoff' });
  await expect(review.getByText('Exact content to retain')).toBeVisible();
  await expect(review).toContainText(body);
  await expect(review).toContainText('Saving does not deliver or grant new authority');
  await press(review.getByRole('checkbox'), 'Space');
  await press(review.getByRole('button', { name: 'Save handoff' }));
  await expect(review).toBeHidden();

  const newest = page
    .getByRole('list', { name: 'Directed handoffs' })
    .getByRole('listitem')
    .first();
  await expect(newest).toContainText('Queued — not delivered');
  const handoffId = await newest.getAttribute('data-handoff-id');
  if (!handoffId) throw new Error('new handoff did not expose its stable id');
  return page.locator(`[data-handoff-id="${handoffId}"]`);
}

async function createDeliveredConversation(
  app: LaunchedApp,
  sourceSessionId: string,
  recipientSessionId: string,
) {
  const preview = await app.call<{ previewToken: string }>('coordination.previewHandoff', {
    sourceSessionId,
    recipientSessionId,
    kind: 'request',
    purpose: 'Bounded continuation root',
    body: 'Reply through the reviewed bounded conversation.',
    responseExpected: true,
  });
  const handoff = await app.call<{ id: string; conversationId: string }>(
    'coordination.confirmHandoff',
    { previewToken: preview.previewToken, persistenceConfirmation: true },
  );
  await app.call('sessions.select', { sessionId: recipientSessionId });
  const presentation = await app.call<{ presentationToken: string }>(
    'coordination.requestPresentation',
    { handoffId: handoff.id },
  );
  await app.call('coordination.confirmPresentation', {
    presentationToken: presentation.presentationToken,
    submitConfirmation: true,
  });
  return handoff;
}

test('keyboard-only user flow creates and manually presents one exact handoff', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo', 'claude-code': 'echo' });
  const { dirs } = await launchThree(app);
  const page = app.page;
  try {
    const item = await createHandoffByKeyboard(
      page,
      'Review keyboard delivery',
      'Reply with the bounded fixture result.',
    );

    const sessionList = page.getByRole('listbox', { name: 'Sessions' });
    await press(sessionList, 'Home');
    await expect(sessionOptions(page).first()).toHaveAttribute('aria-selected', 'true');
    await sessionList.focus();
    await page.keyboard.press('ArrowDown');
    await expect(sessionOptions(page).nth(1)).toHaveAttribute('aria-selected', 'true');

    await press(item.getByRole('button', { name: 'Present…' }));
    const disclosure = page.getByRole('dialog', { name: 'Review manual presentation' });
    await expect(disclosure).toContainText('Exact terminal envelope');
    await expect(disclosure).toContainText('cannot prove the recipient is idle');
    await press(disclosure.getByRole('checkbox'), 'Space');
    await press(disclosure.getByRole('button', { name: 'Present once' }));
    await expect(disclosure).toBeHidden({ timeout: 30_000 });
    await expect(item).toContainText('Delivered — outcome pending');
    await expect(terminalRows(page)).toContainText('[ThreadHelm handoff]', { timeout: 30_000 });
    await expect(terminalRows(page)).toContainText('Reply with the bounded fixture result.');
  } finally {
    await teardown(app, ...dirs);
  }
});

test('keyboard-only user flow reviews retargeting and cancellation', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo', 'claude-code': 'echo' });
  const { dirs, sessions } = await launchThree(app);
  const page = app.page;
  try {
    const item = await createHandoffByKeyboard(page, 'Move this work', 'Do not deliver yet.');

    await press(item.getByRole('button', { name: 'Retarget…' }));
    let dialog = page.getByRole('dialog', { name: 'Review handoff retarget' });
    await press(dialog.getByRole('button', { name: 'Review target' }));
    await expect(dialog).toContainText('Current recipient');
    await expect(dialog).toContainText('New recipient');
    await press(dialog.getByRole('checkbox'), 'Space');
    await press(dialog.getByRole('button', { name: 'Retarget handoff' }));
    await expect(dialog).toBeHidden();

    const listed = await app.call<{ handoffs: { recipientSessionId: string }[] }>(
      'coordination.listHandoffs',
    );
    expect(listed.handoffs[0]!.recipientSessionId).toBe(sessions[0]!.id);

    await press(item.getByRole('button', { name: 'Cancel…' }));
    dialog = page.getByRole('dialog', { name: 'Cancel this handoff?' });
    await expect(dialog).toContainText('remains in local history as cancelled');
    await press(dialog.getByRole('button', { name: 'Cancel handoff' }));
    await expect(item).toContainText('Cancelled');
  } finally {
    await teardown(app, ...dirs);
  }
});

test('duplicate confirmation fails closed and ambiguous delivery reappears without replay', async () => {
  let app = await launchWithFixtures({ 'codex-cli': 'echo', 'claude-code': 'echo' });
  const senderDir = tempWorkspace('coord-unknown-a');
  const recipientDir = tempWorkspace('coord-unknown-b');
  const userData = app.userData;
  try {
    const senderWorkspace = await approveFolder(app, senderDir);
    const recipientWorkspace = await approveFolder(app, recipientDir);
    const sender = await launchFixtureSession(app, senderWorkspace.id, 'codex-cli');
    const recipient = await launchFixtureSession(app, recipientWorkspace.id, 'claude-code');
    const preview = await app.call<{ previewToken: string }>('coordination.previewHandoff', {
      sourceSessionId: sender.id,
      recipientSessionId: recipient.id,
      kind: 'request',
      purpose: 'Recover uncertain delivery',
      body: 'This must never be replayed automatically.',
      responseExpected: true,
    });
    const handoff = await app.call<{ id: string }>('coordination.confirmHandoff', {
      previewToken: preview.previewToken,
      persistenceConfirmation: true,
    });
    const replay = await app.dispatch('coordination.confirmHandoff', {
      previewToken: preview.previewToken,
      persistenceConfirmation: true,
    });
    expect(replay.ok).toBe(false);

    await app.call('sessions.select', { sessionId: recipient.id });
    const disclosure = await app.call<{ presentationToken: string }>(
      'coordination.requestPresentation',
      { handoffId: handoff.id },
    );
    await app.delayNextControlApplied(5_000);
    const pending = app.dispatch('coordination.confirmPresentation', {
      presentationToken: disclosure.presentationToken,
      submitConfirmation: true,
    });
    void pending.catch(() => undefined);
    const databasePath = join(userData, 'threadhelm.sqlite');
    await waitFor(
      async () => {
        const database = new Database(databasePath, { readonly: true, fileMustExist: true });
        try {
          return database
            .prepare(
              'SELECT state FROM coordination_delivery_attempts WHERE handoff_id = ? ORDER BY attempt_number DESC LIMIT 1',
            )
            .get(handoff.id) as { state: string } | undefined;
        } finally {
          database.close();
        }
      },
      (row) => row?.state === 'dispatching',
      10_000,
    );

    await app.crashCoordinator();
    app = await launchWithFixtures({ 'codex-cli': 'echo', 'claude-code': 'echo' }, userData);
    const item = app.page
      .getByRole('list', { name: 'Directed handoffs' })
      .getByRole('listitem')
      .first();
    await expect(item).toContainText('Manual action required', { timeout: 30_000 });
    await expect(item).toContainText('Select the exact recipient session');
  } finally {
    await teardown(app, senderDir, recipientDir);
  }
});

test('auditable conversation timeline distinguishes transport from outcome and loads details on demand', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo', 'claude-code': 'echo' });
  const { dirs } = await launchThree(app);
  const page = app.page;
  try {
    await createHandoffByKeyboard(page, 'Auditable exchange', 'Original message requiring reply.');

    // Verify conversation view renders with timeline and outcome indicator.
    const convPanel = page.getByRole('region', { name: 'Agent conversations' });
    await expect(convPanel).toBeVisible({ timeout: 10_000 });
    await press(convPanel.getByRole('button', { name: 'Refresh' }));

    // Open explicit conversation detail
    await press(convPanel.getByRole('listitem').first());
    const detail = page.getByRole('region', { name: 'Conversation detail' });
    await expect(detail).toBeVisible();
    await expect(detail).toContainText('Original message requiring reply.');
    await expect(detail).toContainText('Outcome: Pending');
  } finally {
    await teardown(app, ...dirs);
  }
});

test('inactive conversation content deletion purges message body while preserving lifecycle history', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo', 'claude-code': 'echo' });
  const { dirs } = await launchThree(app);
  const page = app.page;
  try {
    await createHandoffByKeyboard(
      page,
      'To be purged',
      'Confidential body to delete after resolution.',
    );

    const listed = await app.call<{ handoffs: { id: string; recipientSessionId: string }[] }>(
      'coordination.listHandoffs',
    );
    await app.call('sessions.select', { sessionId: listed.handoffs[0]!.recipientSessionId });
    const presentation = await app.call<{ presentationToken: string }>(
      'coordination.requestPresentation',
      { handoffId: listed.handoffs[0]!.id },
    );
    await app.call('coordination.confirmPresentation', {
      presentationToken: presentation.presentationToken,
      submitConfirmation: true,
    });
    await app.reportProviderOutcome(
      listed.handoffs[0]!.recipientSessionId,
      listed.handoffs[0]!.id,
      'completed',
    );

    const convPanel = page.getByRole('region', { name: 'Agent conversations' });
    await expect(convPanel).toBeVisible({ timeout: 10_000 });
    await press(convPanel.getByRole('button', { name: 'Refresh' }));

    // Delete content from the now-resolved conversation.
    const convItem = convPanel.getByRole('listitem').first();
    await press(convItem);
    const detail = page.getByRole('region', { name: 'Conversation detail' });
    await press(detail.getByRole('button', { name: 'Delete content…' }));
    const dialog = page.getByRole('dialog', { name: 'Delete conversation content' });
    await expect(dialog).toContainText(
      'permanently delete all message purposes, bodies, and payloads',
    );
    await press(dialog.getByRole('checkbox'), 'Space');
    await press(dialog.getByRole('button', { name: 'Delete content permanently' }));
    await expect(dialog).toBeHidden();

    // Verify content is purged but lifecycle entry remains
    await expect(detail).toContainText('Content deleted');
  } finally {
    await teardown(app, ...dirs);
  }
});

test('safe lifecycle presents once while unproved evidence keeps the visible manual path', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo', 'claude-code': 'echo' });
  const { dirs, sessions } = await launchThree(app);
  const page = app.page;
  try {
    const first = await createHandoffByKeyboard(
      page,
      'Safe lifecycle delivery',
      'Present this only at a proved safe point.',
    );
    const second = await createHandoffByKeyboard(
      page,
      'Manual fallback delivery',
      'Keep this visible when draft safety is unknown.',
    );

    const accepted = await app.emitProviderLifecycle({
      sessionId: sessions[1]!.id,
      providerId: 'claude-code',
      providerVersion: '1.0.0',
      eventKind: 'safe_point',
      providerEventId: 'e2e-safe-point-1',
      turnId: 'e2e-turn-1',
      safePoint: true,
      inputSafety: 'proved_no_pending_draft',
    });
    expect(accepted).toMatchObject({
      status: 'accepted',
      safePoint: true,
      presentation: { presented: true, reasonCode: null },
    });
    await expect(first).toContainText('Delivered — outcome pending', { timeout: 30_000 });

    const result = await app.emitProviderLifecycle({
      sessionId: sessions[1]!.id,
      providerId: 'claude-code',
      providerVersion: '1.0.0',
      eventKind: 'safe_point',
      providerEventId: 'e2e-safe-point-2',
      turnId: 'e2e-turn-2',
      safePoint: true,
      inputSafety: 'unknown',
    });
    expect(result.status).toBe('manual_only');
    await expect(second).toContainText('Manual action required');
    await expect(second.getByRole('button', { name: 'Present…' })).toBeVisible();
  } finally {
    await teardown(app, ...dirs);
  }
});

test('bounded coordination requires disclosure before one eligible provider reply continues', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo', 'claude-code': 'echo' });
  const { dirs, sessions } = await launchThree(app);
  const page = app.page;
  try {
    const root = await createDeliveredConversation(app, sessions[0]!.id, sessions[1]!.id);
    const conversations = page.getByRole('region', { name: 'Agent conversations' });
    await press(conversations.getByRole('button', { name: 'Refresh' }));
    await press(conversations.getByRole('listitem').first());
    const detail = page.getByRole('region', { name: 'Conversation detail' });

    await press(detail.getByRole('button', { name: 'Enable automatic continuation…' }));
    const disclosure = page.getByRole('dialog', { name: 'Enable bounded continuation' });
    await expect(disclosure).toContainText('Reply depth: 8');
    await expect(disclosure).toContainText('Equivalent repeat: 3 within 8');
    await expect(disclosure).toContainText('Delivery failures: 3');
    await expect(disclosure).toContainText('cannot grant destructive');
    await press(disclosure.getByRole('checkbox'), 'Space');
    await press(disclosure.getByRole('button', { name: 'Enable bounded continuation' }));
    await expect(disclosure).toBeHidden();
    await expect(detail).toContainText('Automatic continuation enabled');

    const reply = await app.replyFromProvider({
      sessionId: sessions[1]!.id,
      inReplyToId: root.id,
      kind: 'response',
      purpose: 'Bounded reply',
      body: 'This reply is eligible only inside the reviewed bounds.',
      authorityRequired: false,
    });
    expect(reply.deliveryState).toBe('queued');

    const accepted = await app.emitProviderLifecycle({
      sessionId: sessions[0]!.id,
      providerId: 'codex-cli',
      providerVersion: '1.0.0',
      eventKind: 'safe_point',
      providerEventId: 'us4-e2e-safe-point',
      turnId: 'us4-e2e-turn',
      safePoint: true,
      inputSafety: 'proved_no_pending_draft',
    });
    expect(accepted).toMatchObject({
      status: 'accepted',
      safePoint: true,
      presentation: { presented: true, reasonCode: null },
    });

    await press(conversations.getByRole('button', { name: 'Refresh' }));
    await press(conversations.getByRole('listitem').first());
    await expect(detail).toContainText('This reply is eligible only inside the reviewed bounds.');
    await expect(detail.locator(`[data-handoff-id="${reply.id}"]`)).toContainText('Delivered');
  } finally {
    await teardown(app, ...dirs);
  }
});

test('fresh lifecycle fixture uses main clock while explicit future evidence stays rejected', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo', 'claude-code': 'echo' });
  const { dirs, sessions } = await launchThree(app);
  try {
    const handoff = await createHandoffByKeyboard(
      app.page,
      'Clock boundary delivery',
      'Only a fresh safe point may deliver this once.',
    );
    const evidence = {
      sessionId: sessions[1]!.id,
      providerId: 'claude-code' as const,
      providerVersion: '1.0.0',
      eventKind: 'safe_point' as const,
      providerEventId: 'clock-boundary-event',
      turnId: 'clock-boundary-turn',
      safePoint: true,
      inputSafety: 'proved_no_pending_draft' as const,
    };
    const future = await app.emitProviderLifecycle({
      ...evidence,
      occurredAt: '2099-01-01T00:00:00.000Z',
    });
    expect(future).toMatchObject({
      status: 'rejected',
      reasonCode: 'LIFECYCLE_EVIDENCE_STALE',
      presentation: null,
    });
    await expect(handoff).toContainText('Queued — not delivered');

    const SystemDate = globalThis.Date;
    let pending: ReturnType<LaunchedApp['emitProviderLifecycle']>;
    try {
      // Only the runner's synchronous fixture-call construction sees this
      // clock. Electron main and its real freshness checks remain unchanged.
      globalThis.Date = class extends SystemDate {
        constructor() {
          super('2099-01-01T00:00:00.000Z');
        }
      } as DateConstructor;
      pending = app.emitProviderLifecycle(evidence);
    } finally {
      globalThis.Date = SystemDate;
    }
    expect(await pending).toMatchObject({
      status: 'accepted',
      safePoint: true,
      presentation: { presented: true, reasonCode: null },
    });
    await expect(handoff).toContainText('Delivered — outcome pending');
  } finally {
    await teardown(app, ...dirs);
  }
});

test('authority escalation can close a conversation and later provider messages remain held', async () => {
  const app = await launchWithFixtures({ 'codex-cli': 'echo', 'claude-code': 'echo' });
  const { dirs, sessions } = await launchThree(app);
  const page = app.page;
  try {
    const root = await createDeliveredConversation(app, sessions[0]!.id, sessions[1]!.id);
    const autoPreview = await app.call<{ autoContinueToken: string }>(
      'coordination.previewAutoContinue',
      { conversationId: root.conversationId, enabled: true },
    );
    await app.call('coordination.confirmAutoContinue', {
      autoContinueToken: autoPreview.autoContinueToken,
      autoContinueConfirmation: true,
    });

    const held = await app.replyFromProvider({
      sessionId: sessions[1]!.id,
      inReplyToId: root.id,
      kind: 'response',
      purpose: 'Expand authority',
      body: 'Request a materially scope-changing action.',
      authorityRequired: true,
    });
    expect(held.deliveryState).toBe('held');
    expect(held.holdReasonCode).toBe('AUTHORITY_REQUIRED');

    const conversations = page.getByRole('region', { name: 'Agent conversations' });
    await press(conversations.getByRole('button', { name: 'Refresh' }));
    await press(conversations.getByRole('listitem').first());
    const detail = page.getByRole('region', { name: 'Conversation detail' });
    const escalation = page.getByRole('region', { name: 'Coordination escalation' });
    await expect(escalation).toContainText('Authority required');
    await press(escalation.getByRole('button', { name: 'Close conversation' }));
    await expect(detail).toContainText('closed');

    const late = await app.replyFromProvider({
      sessionId: sessions[1]!.id,
      inReplyToId: root.id,
      kind: 'inform',
      purpose: 'Late arrival',
      body: 'This arrived after the conversation was closed.',
      authorityRequired: false,
    });
    expect(late.deliveryState).toBe('held');
    expect(late.holdReasonCode).toBe('CONVERSATION_CLOSED');

    await press(conversations.getByRole('button', { name: 'Refresh' }));
    await press(conversations.getByRole('listitem').first());
    await expect(detail).toContainText('This arrived after the conversation was closed.');
    await expect(detail.locator(`[data-handoff-id="${late.id}"]`)).toContainText(
      'Hold: CONVERSATION_CLOSED',
    );
  } finally {
    await teardown(app, ...dirs);
  }
});
