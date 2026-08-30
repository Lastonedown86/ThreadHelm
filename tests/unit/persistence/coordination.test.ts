import { afterEach, describe, expect, it } from 'vitest';
import {
  createRepositories,
  MAX_RETAINED_COORDINATION_BYTES,
  migrate,
  openDatabase,
  readSchemaVersion,
  SCHEMA_VERSION,
  type Db,
} from '@threadhelm/persistence';

const IDS = {
  senderWorkspace: '00000000-0000-4000-8000-000000000011',
  recipientWorkspace: '00000000-0000-4000-8000-000000000012',
  thirdWorkspace: '00000000-0000-4000-8000-000000000013',
  sender: '00000000-0000-4000-8000-000000000001',
  recipient: '00000000-0000-4000-8000-000000000002',
  thirdSession: '00000000-0000-4000-8000-000000000003',
  conversation: '00000000-0000-4000-8000-000000000021',
  secondConversation: '00000000-0000-4000-8000-000000000023',
  handoff: '00000000-0000-4000-8000-000000000022',
  secondHandoff: '00000000-0000-4000-8000-000000000024',
};

let db: Db;
afterEach(() => db?.close());

function openMigrated(): Db {
  db = openDatabase(':memory:');
  migrate(db);
  return db;
}

function tables(database: Db): string[] {
  return (
    database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as {
      name: string;
    }[]
  ).map(({ name }) => name);
}

const AT = '2026-01-01T00:00:00.000Z';

function seedSessions(database: Db): void {
  const workspace = database.prepare(`INSERT INTO approved_workspaces
    (id, selected_path, display_path, canonical_path, volume_serial, file_id, drive_type, approved_at, last_validated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'fixed_local', ?, ?)`);
  workspace.run(
    IDS.senderWorkspace,
    'C:\\sender',
    'C:\\sender',
    '\\\\?\\C:\\sender',
    '0000000000000001',
    '00000000000000000000000000000001',
    AT,
    AT,
  );
  workspace.run(
    IDS.recipientWorkspace,
    'C:\\recipient',
    'C:\\recipient',
    '\\\\?\\C:\\recipient',
    '0000000000000002',
    '00000000000000000000000000000002',
    AT,
    AT,
  );
  workspace.run(
    IDS.thirdWorkspace,
    'C:\\third',
    'C:\\third',
    '\\\\?\\C:\\third',
    '0000000000000003',
    '00000000000000000000000000000003',
    AT,
    AT,
  );
  const definition = database.prepare(`INSERT INTO agent_definitions
    (id, display_name, provider_kind, executable_candidates, tested_version_range, capabilities)
    VALUES (?, ?, ?, '[]', 'fixture', '{}')`);
  definition.run('codex-cli', 'Codex CLI', 'codex-cli');
  definition.run('claude-code', 'Claude Code', 'claude-code');
  const readiness = database.prepare(`INSERT INTO agent_readiness_snapshots
    (id, provider_id, resolved_executable, version, availability, authentication, probed_at, reason_code, safe_summary)
    VALUES (?, ?, 'C:\\fixture.exe', '1.0.0', 'available', 'authenticated', ?, NULL, 'Fixture available')`);
  readiness.run('00000000-0000-4000-8000-000000000041', 'codex-cli', AT);
  readiness.run('00000000-0000-4000-8000-000000000042', 'claude-code', AT);
  const session = database.prepare(`INSERT INTO agent_sessions
    (id, workspace_id, definition_id, readiness_snapshot_id, access_mode, lifecycle_state,
     activity_state, activity_evidence_kind, columns, rows, started_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'write_capable', 'running', 'unknown', 'none', 100, 30, ?, ?, ?)`);
  session.run(
    IDS.sender,
    IDS.senderWorkspace,
    'codex-cli',
    '00000000-0000-4000-8000-000000000041',
    AT,
    AT,
    AT,
  );
  session.run(
    IDS.recipient,
    IDS.recipientWorkspace,
    'claude-code',
    '00000000-0000-4000-8000-000000000042',
    AT,
    AT,
    AT,
  );
  session.run(
    IDS.thirdSession,
    IDS.thirdWorkspace,
    'codex-cli',
    '00000000-0000-4000-8000-000000000041',
    AT,
    AT,
    AT,
  );
}

function seedConversationAndHandoff(database: Db, contentBytes = 4, sessionsSeeded = false): void {
  if (!sessionsSeeded) seedSessions(database);
  database
    .prepare(
      `INSERT INTO coordination_conversations
    (id, state, auto_continue_enabled, auto_reply_depth_limit, consecutive_delivery_failures, created_at, updated_at)
    VALUES (?, 'open', 0, 8, 0, ?, ?)`,
    )
    .run(IDS.conversation, AT, AT);
  database
    .prepare(
      `INSERT INTO coordination_handoffs
    (id, conversation_id, sender_session_id, recipient_session_id,
     sender_workspace_id_at_create, recipient_workspace_id_at_create, origin, kind, requires_reply,
     purpose, body, content_bytes, content_fingerprint, delivery_state, work_outcome, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'user', 'request', 1, 'test', 'body', ?, zeroblob(32), 'presenting', 'pending', ?, ?)`,
    )
    .run(
      IDS.handoff,
      IDS.conversation,
      IDS.sender,
      IDS.recipient,
      IDS.senderWorkspace,
      IDS.recipientWorkspace,
      contentBytes,
      AT,
      AT,
    );
}

function handoffInput(overrides: Record<string, unknown> = {}) {
  return {
    id: IDS.secondHandoff,
    conversationId: IDS.secondConversation,
    senderSessionId: IDS.sender,
    recipientSessionId: IDS.recipient,
    senderWorkspaceIdAtCreate: IDS.senderWorkspace,
    recipientWorkspaceIdAtCreate: IDS.recipientWorkspace,
    origin: 'user' as const,
    kind: 'request' as const,
    requiresReply: true,
    purpose: 'Fixture request',
    body: 'Fixture body',
    createdAt: AT,
    ...overrides,
  };
}

describe('coordination migration v2', () => {
  it('retains the v2 coordination tables through the current transactional schema', () => {
    const database = openMigrated();
    expect(readSchemaVersion(database)).toBe(SCHEMA_VERSION);
    expect(tables(database)).toEqual(
      expect.arrayContaining([
        'coordination_conversations',
        'coordination_handoffs',
        'coordination_delivery_attempts',
        'coordination_events',
      ]),
    );
  });

  it('keeps the existing v1 session/recovery data when v2 applies', () => {
    const database = openMigrated();
    expect(database.prepare('SELECT COUNT(*) AS n FROM agent_sessions').get()).toEqual({ n: 0 });
    expect(database.prepare('SELECT COUNT(*) AS n FROM recovery_records').get()).toEqual({ n: 0 });
  });
});

describe('coordination repository invariants', () => {
  it('lists durable handoffs newest first with a strict US1 bound', () => {
    const database = openMigrated();
    seedSessions(database);
    const coordination = createRepositories(database).coordination;
    const first = coordination.createHandoff(handoffInput());
    const second = coordination.createHandoff(
      handoffInput({
        id: IDS.handoff,
        conversationId: IDS.conversation,
        createdAt: '2026-01-01T00:00:01.000Z',
      }),
    );

    expect(coordination.listHandoffs(1).map(({ id }) => id)).toEqual([second.id]);
    expect(coordination.listHandoffs(2).map(({ id }) => id)).toEqual([second.id, first.id]);
    expect(() => coordination.listHandoffs(101)).toThrow();
  });

  it('creates one addressed handoff and one content-free event atomically', () => {
    const database = openMigrated();
    seedSessions(database);
    const coordination = createRepositories(database).coordination;

    const created = coordination.createHandoff(handoffInput());

    expect(created).toMatchObject({
      conversationId: IDS.secondConversation,
      senderSessionId: IDS.sender,
      recipientSessionId: IDS.recipient,
      deliveryState: 'queued',
      workOutcome: 'pending',
    });
    expect(database.prepare('SELECT COUNT(*) AS n FROM coordination_conversations').get()).toEqual({
      n: 1,
    });
    expect(database.prepare('SELECT COUNT(*) AS n FROM coordination_events').get()).toEqual({
      n: 1,
    });
    const event = database.prepare('SELECT * FROM coordination_events').get() as Record<
      string,
      unknown
    >;
    expect(event).not.toHaveProperty('body');
    expect(event).not.toHaveProperty('purpose');
  });

  it('enforces one prepared/dispatching and one applied attempt per handoff', () => {
    const database = openMigrated();
    seedConversationAndHandoff(database);
    const insert = database.prepare(`INSERT INTO coordination_delivery_attempts
      (id, handoff_id, attempt_number, recipient_session_id, recipient_workspace_id_at_review,
       lifecycle_state_at_review, activity_state_at_review, activity_evidence_kind_at_review,
       state, evidence_kind, created_at, submitted_at, completed_at)
      VALUES (?, ?, ?, ?, ?, 'running', 'unknown', 'none', ?, 'fixture', ?, ?, ?)`);
    const run = (id: string, number: number, state: string, at: string) =>
      insert.run(
        id,
        IDS.handoff,
        number,
        IDS.recipient,
        IDS.recipientWorkspace,
        state,
        at,
        state === 'dispatching' ? at : null,
        state === 'applied' ? at : null,
      );
    run('00000000-0000-4000-8000-000000000031', 1, 'prepared', AT);
    expect(() =>
      run('00000000-0000-4000-8000-000000000032', 2, 'dispatching', '2026-01-01T00:00:01.000Z'),
    ).toThrow();
    expect(() =>
      run('00000000-0000-4000-8000-000000000033', 3, 'applied', '2026-01-01T00:00:02.000Z'),
    ).not.toThrow();
    expect(() =>
      run('00000000-0000-4000-8000-000000000034', 4, 'applied', '2026-01-01T00:00:03.000Z'),
    ).toThrow();
  });

  it('rolls back a failed handoff write and exposes unknown-attempt recovery', () => {
    const database = openMigrated();
    seedSessions(database);
    const coordination = createRepositories(database).coordination;
    database.exec(`CREATE TRIGGER fixture_fail_handoff BEFORE INSERT ON coordination_handoffs
      BEGIN SELECT RAISE(ABORT, 'fixture rollback'); END;`);
    expect(() => coordination.createHandoff(handoffInput())).toThrow();
    expect(database.prepare('SELECT COUNT(*) AS n FROM coordination_conversations').get()).toEqual({
      n: 0,
    });
    expect(database.prepare('SELECT COUNT(*) AS n FROM coordination_handoffs').get()).toEqual({
      n: 0,
    });
    expect(database.prepare('SELECT COUNT(*) AS n FROM coordination_events').get()).toEqual({
      n: 0,
    });
    database.exec('DROP TRIGGER fixture_fail_handoff');

    seedConversationAndHandoff(database, 4, true);
    database
      .prepare(
        `INSERT INTO coordination_delivery_attempts
      (id, handoff_id, attempt_number, recipient_session_id, recipient_workspace_id_at_review,
       lifecycle_state_at_review, activity_state_at_review, activity_evidence_kind_at_review,
       state, evidence_kind, reason_code, created_at, completed_at)
      VALUES (?, ?, 1, ?, ?, 'running', 'unknown', 'none', 'unknown', 'recovery',
        'OUTCOME_UNCERTAIN', ?, ?)`,
      )
      .run(
        '00000000-0000-4000-8000-000000000035',
        IDS.handoff,
        IDS.recipient,
        IDS.recipientWorkspace,
        AT,
        AT,
      );
    expect(coordination.listUnknownAttempts()).toEqual([
      expect.objectContaining({ id: '00000000-0000-4000-8000-000000000035', state: 'unknown' }),
    ]);
  });

  it('rejects a handoff that would exceed retained-content quota', () => {
    const database = openMigrated();
    seedConversationAndHandoff(database, MAX_RETAINED_COORDINATION_BYTES);
    const coordination = createRepositories(database).coordination;
    expect(() => coordination.createHandoff(handoffInput())).toThrowError(
      expect.objectContaining({ code: 'COORDINATION_LIMIT_REACHED' }),
    );
  });

  it('prepares, dispatches, and applies exactly one delivery attempt', () => {
    const database = openMigrated();
    seedSessions(database);
    const coordination = createRepositories(database).coordination;
    const handoff = coordination.createHandoff(handoffInput());
    const prepared = coordination.prepareAttempt({
      id: '00000000-0000-4000-8000-000000000031',
      handoffId: handoff.id,
      recipientSessionId: IDS.recipient,
      recipientWorkspaceIdAtReview: IDS.recipientWorkspace,
      lifecycleStateAtReview: 'running',
      activityStateAtReview: 'unknown',
      activityEvidenceKindAtReview: 'none',
      createdAt: AT,
    });
    expect(prepared.state).toBe('prepared');
    expect(() =>
      coordination.prepareAttempt({
        ...prepared,
        id: '00000000-0000-4000-8000-000000000032',
        recipientWorkspaceIdAtReview: IDS.recipientWorkspace,
        lifecycleStateAtReview: 'running',
        activityStateAtReview: 'unknown',
        activityEvidenceKindAtReview: 'none',
      }),
    ).toThrowError(expect.objectContaining({ code: 'COORDINATION_ATTEMPT_ACTIVE' }));
    expect(coordination.markAttemptDispatching(prepared.id, 7, AT)).toMatchObject({
      state: 'dispatching',
      controlSequence: 7,
    });
    expect(coordination.markAttemptApplied(prepared.id, AT).state).toBe('applied');
    expect(coordination.findHandoffById(handoff.id)?.deliveryState).toBe('delivered');
    expect(coordination.markAttemptApplied(prepared.id, AT).state).toBe('applied');
  });

  it('keeps known failure retry, retarget, and cancellation explicit', () => {
    const database = openMigrated();
    seedSessions(database);
    const coordination = createRepositories(database).coordination;
    const first = coordination.createHandoff(handoffInput());
    const attempt = coordination.prepareAttempt({
      handoffId: first.id,
      recipientSessionId: IDS.recipient,
      recipientWorkspaceIdAtReview: IDS.recipientWorkspace,
      lifecycleStateAtReview: 'running',
      activityStateAtReview: 'unknown',
      activityEvidenceKindAtReview: 'none',
      createdAt: AT,
    });
    coordination.markAttemptFailedBeforeWrite(attempt.id, 'KNOWN_NO_WRITE', AT);
    expect(coordination.findHandoffById(first.id)?.deliveryState).toBe('manual_actionable');

    const retargeted = coordination.retargetHandoff(
      first.id,
      IDS.thirdSession,
      IDS.thirdWorkspace,
      AT,
    );
    expect(retargeted).toMatchObject({
      recipientSessionId: IDS.thirdSession,
      recipientWorkspaceIdAtCreate: IDS.thirdWorkspace,
      deliveryState: 'queued',
    });
    expect(coordination.cancelHandoff(first.id, AT)).toMatchObject({
      deliveryState: 'cancelled',
      workOutcome: 'cancelled',
    });
  });

  it('rejects direct presentation or cancellation from the failed delivery state', () => {
    const database = openMigrated();
    seedSessions(database);
    const coordination = createRepositories(database).coordination;
    const failed = coordination.createHandoff(
      handoffInput({ deliveryState: 'failed', holdReasonCode: 'KNOWN_NO_WRITE' }),
    );

    expect(() =>
      coordination.prepareAttempt({
        handoffId: failed.id,
        recipientSessionId: IDS.recipient,
        recipientWorkspaceIdAtReview: IDS.recipientWorkspace,
        lifecycleStateAtReview: 'running',
        activityStateAtReview: 'unknown',
        activityEvidenceKindAtReview: 'none',
        createdAt: AT,
      }),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_STATE' }));
    expect(() => coordination.cancelHandoff(failed.id, AT)).toThrowError(
      expect.objectContaining({ code: 'COORDINATION_DELIVERY_UNKNOWN' }),
    );
  });

  it('persists opt-in and atomically holds an authority reply with one open escalation', () => {
    const database = openMigrated();
    seedSessions(database);
    const coordination = createRepositories(database).coordination;
    const root = coordination.createHandoff(handoffInput());
    const attempt = coordination.prepareAttempt({
      handoffId: root.id,
      recipientSessionId: IDS.recipient,
      recipientWorkspaceIdAtReview: IDS.recipientWorkspace,
      lifecycleStateAtReview: 'running',
      activityStateAtReview: 'unknown',
      activityEvidenceKindAtReview: 'none',
      createdAt: AT,
    });
    coordination.markAttemptDispatching(attempt.id, 1, AT);
    coordination.markAttemptApplied(attempt.id, AT);
    expect(
      coordination.setAutoContinueEnabled(root.conversationId, true, AT).autoContinueEnabled,
    ).toBe(true);

    database.exec(`CREATE TRIGGER fixture_fail_escalation BEFORE INSERT ON coordination_escalations
      BEGIN SELECT RAISE(ABORT, 'fixture escalation rollback'); END;`);
    expect(() =>
      coordination.createBridgeReply({
        inReplyToId: root.id,
        senderSessionId: IDS.recipient,
        kind: 'response',
        purpose: 'Authority request',
        body: 'Expand the approved workspace scope.',
        authorityRequired: true,
        createdAt: AT,
      }),
    ).toThrow();
    expect(database.prepare('SELECT COUNT(*) AS n FROM coordination_handoffs').get()).toEqual({
      n: 1,
    });
    database.exec('DROP TRIGGER fixture_fail_escalation');

    const queuedSibling = coordination.createBridgeReply({
      inReplyToId: root.id,
      senderSessionId: IDS.recipient,
      kind: 'inform',
      purpose: 'Queued before pause',
      body: 'This sibling must not present after another reply pauses the conversation.',
      createdAt: AT,
    });
    expect(queuedSibling.deliveryState).toBe('queued');

    const held = coordination.createBridgeReply({
      inReplyToId: root.id,
      senderSessionId: IDS.recipient,
      kind: 'response',
      purpose: 'Authority request',
      body: 'Expand the approved workspace scope.',
      authorityRequired: true,
      createdAt: AT,
    });
    expect(held).toMatchObject({
      deliveryState: 'held',
      holdReasonCode: 'AUTHORITY_REQUIRED',
    });
    expect(coordination.getConversationSummary(root.conversationId)).toMatchObject({
      state: 'paused',
      pauseReasonCode: 'AUTHORITY_REQUIRED',
      autoContinueEnabled: true,
    });
    expect(coordination.getOpenEscalation(root.conversationId)).toMatchObject({
      handoffId: held.id,
      kind: 'authority_required',
      state: 'open',
      reasonCode: 'AUTHORITY_REQUIRED',
    });
    expect(coordination.findHandoffById(queuedSibling.id)).toMatchObject({
      deliveryState: 'held',
      holdReasonCode: 'CONVERSATION_PAUSED',
    });

    const late = coordination.createBridgeReply({
      inReplyToId: root.id,
      senderSessionId: IDS.recipient,
      kind: 'inform',
      purpose: 'Late information',
      body: 'Retain this while the conversation remains paused.',
      createdAt: '2026-01-01T00:00:01.000Z',
    });
    expect(late).toMatchObject({
      deliveryState: 'held',
      holdReasonCode: 'CONVERSATION_PAUSED',
    });
    expect(
      database
        .prepare("SELECT COUNT(*) AS n FROM coordination_escalations WHERE state = 'open'")
        .get(),
    ).toEqual({ n: 1 });
  });

  it('pauses transactionally on the third consecutive delivery failure', () => {
    const database = openMigrated();
    seedSessions(database);
    const coordination = createRepositories(database).coordination;

    for (let index = 0; index < 3; index += 1) {
      const handoff = coordination.createHandoff(
        handoffInput({
          id: `00000000-0000-4000-8000-00000000005${index}`,
          conversationId: IDS.conversation,
          createdAt: `2026-01-01T00:00:0${index}.000Z`,
        }),
      );
      const attempt = coordination.prepareAttempt({
        handoffId: handoff.id,
        recipientSessionId: IDS.recipient,
        recipientWorkspaceIdAtReview: IDS.recipientWorkspace,
        lifecycleStateAtReview: 'running',
        activityStateAtReview: 'unknown',
        activityEvidenceKindAtReview: 'none',
        createdAt: `2026-01-01T00:00:0${index}.000Z`,
      });
      coordination.markAttemptFailedBeforeWrite(
        attempt.id,
        'KNOWN_NO_WRITE',
        `2026-01-01T00:00:0${index}.500Z`,
      );
      expect(coordination.getConversationSummary(IDS.conversation)?.state).toBe(
        index < 2 ? 'open' : 'paused',
      );
    }

    expect(coordination.getConversationSummary(IDS.conversation)).toMatchObject({
      state: 'paused',
      pauseReasonCode: 'REPEATED_DELIVERY_FAILURE',
    });
    expect(coordination.getOpenEscalation(IDS.conversation)).toMatchObject({
      kind: 'repeated_delivery_failure',
      state: 'open',
    });
    expect(
      database
        .prepare(
          'SELECT consecutive_delivery_failures AS n FROM coordination_conversations WHERE id = ?',
        )
        .get(IDS.conversation),
    ).toEqual({ n: 3 });
  });

  it('resets the consecutive failure counter after a confirmed delivery', () => {
    const database = openMigrated();
    seedSessions(database);
    const coordination = createRepositories(database).coordination;
    const failOrApply = (index: number, applied: boolean) => {
      const handoff = coordination.createHandoff(
        handoffInput({
          id: `00000000-0000-4000-8000-00000000006${index}`,
          conversationId: IDS.conversation,
          createdAt: `2026-01-01T00:00:1${index}.000Z`,
        }),
      );
      const attempt = coordination.prepareAttempt({
        handoffId: handoff.id,
        recipientSessionId: IDS.recipient,
        recipientWorkspaceIdAtReview: IDS.recipientWorkspace,
        lifecycleStateAtReview: 'running',
        activityStateAtReview: 'unknown',
        activityEvidenceKindAtReview: 'none',
        createdAt: `2026-01-01T00:00:1${index}.000Z`,
      });
      if (applied) {
        coordination.markAttemptDispatching(attempt.id, index + 1, AT);
        coordination.markAttemptApplied(attempt.id, AT);
      } else {
        coordination.markAttemptFailedBeforeWrite(attempt.id, 'KNOWN_NO_WRITE', AT);
      }
    };
    failOrApply(0, false);
    failOrApply(1, false);
    failOrApply(2, true);
    failOrApply(3, false);

    expect(coordination.getConversationSummary(IDS.conversation)?.state).toBe('open');
    expect(
      database
        .prepare(
          'SELECT consecutive_delivery_failures AS n FROM coordination_conversations WHERE id = ?',
        )
        .get(IDS.conversation),
    ).toEqual({ n: 1 });
  });

  it('never opens a failure escalation or reopens after the conversation is closed', () => {
    const database = openMigrated();
    seedSessions(database);
    const coordination = createRepositories(database).coordination;
    const handoff = coordination.createHandoff(
      handoffInput({
        id: '00000000-0000-4000-8000-000000000070',
        conversationId: IDS.conversation,
        createdAt: '2026-01-01T00:00:20.000Z',
      }),
    );
    coordination.updateConversationState(IDS.conversation, 'closed', 'USER_CLOSED', AT);
    expect(() =>
      coordination.prepareAttempt({
        handoffId: handoff.id,
        recipientSessionId: IDS.recipient,
        recipientWorkspaceIdAtReview: IDS.recipientWorkspace,
        lifecycleStateAtReview: 'running',
        activityStateAtReview: 'unknown',
        activityEvidenceKindAtReview: 'none',
        createdAt: AT,
      }),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_STATE' }));
    expect(coordination.getConversationSummary(IDS.conversation)?.state).toBe('closed');
    expect(coordination.getOpenEscalation(IDS.conversation)).toBeNull();
  });

  it('applies an exact escalation disposition once and keeps closed-conversation arrivals held', () => {
    const database = openMigrated();
    seedSessions(database);
    const coordination = createRepositories(database).coordination;
    const root = coordination.createHandoff(handoffInput());
    const attempt = coordination.prepareAttempt({
      handoffId: root.id,
      recipientSessionId: IDS.recipient,
      recipientWorkspaceIdAtReview: IDS.recipientWorkspace,
      lifecycleStateAtReview: 'running',
      activityStateAtReview: 'unknown',
      activityEvidenceKindAtReview: 'none',
      createdAt: AT,
    });
    coordination.markAttemptDispatching(attempt.id, 1, AT);
    coordination.markAttemptApplied(attempt.id, AT);
    coordination.setAutoContinueEnabled(root.conversationId, true, AT);
    coordination.createBridgeReply({
      inReplyToId: root.id,
      senderSessionId: IDS.recipient,
      kind: 'response',
      purpose: 'Authority request',
      body: 'Request exact user direction.',
      authorityRequired: true,
      createdAt: AT,
    });
    const escalation = coordination.getOpenEscalation(root.conversationId)!;

    expect(() =>
      coordination.resolveEscalation({
        escalationId: escalation.id,
        disposition: 'redirect',
        recipientSessionId: IDS.recipient,
        recipientWorkspaceId: IDS.recipientWorkspace,
        at: '2026-01-01T00:00:00.500Z',
      }),
    ).toThrowError(expect.objectContaining({ code: 'COORDINATION_NOT_ELIGIBLE' }));

    const resolved = coordination.resolveEscalation({
      escalationId: escalation.id,
      disposition: 'close',
      at: '2026-01-01T00:00:01.000Z',
    });
    expect(resolved).toMatchObject({ state: 'closed', resolution: 'close' });
    expect(coordination.getConversationSummary(root.conversationId)?.state).toBe('closed');
    expect(() =>
      coordination.resolveEscalation({
        escalationId: escalation.id,
        disposition: 'continue',
        at: '2026-01-01T00:00:02.000Z',
      }),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_STATE' }));

    const late = coordination.createBridgeReply({
      inReplyToId: root.id,
      senderSessionId: IDS.recipient,
      kind: 'inform',
      purpose: 'Late after close',
      body: 'This must be retained without reopening the conversation.',
      createdAt: '2026-01-01T00:00:03.000Z',
    });
    expect(late).toMatchObject({
      deliveryState: 'held',
      holdReasonCode: 'CONVERSATION_CLOSED',
    });
    expect(coordination.getConversationSummary(root.conversationId)?.state).toBe('closed');
  });

  it('keeps content deleted when a late provider arrival is retained after close', () => {
    const database = openMigrated();
    seedSessions(database);
    const coordination = createRepositories(database).coordination;
    const root = coordination.createHandoff(handoffInput());
    const attempt = coordination.prepareAttempt({
      handoffId: root.id,
      recipientSessionId: IDS.recipient,
      recipientWorkspaceIdAtReview: IDS.recipientWorkspace,
      lifecycleStateAtReview: 'running',
      activityStateAtReview: 'unknown',
      activityEvidenceKindAtReview: 'none',
      createdAt: AT,
    });
    coordination.markAttemptDispatching(attempt.id, 1, AT);
    coordination.markAttemptApplied(attempt.id, AT);
    coordination.updateConversationState(root.conversationId, 'closed', 'USER_CLOSED', AT);
    coordination.deleteConversationContent(root.conversationId, AT);

    const late = coordination.createBridgeReply({
      inReplyToId: root.id,
      senderSessionId: IDS.recipient,
      kind: 'inform',
      purpose: 'Late deleted purpose',
      body: 'Late deleted body',
      createdAt: AT,
    });
    expect(late).toMatchObject({
      deliveryState: 'held',
      holdReasonCode: 'CONVERSATION_CLOSED',
      purpose: null,
      body: null,
      contentBytes: null,
    });
    expect(coordination.getConversationSummary(root.conversationId)?.contentDeletedAt).toBe(AT);
  });
});
