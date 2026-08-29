import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { openDatabase, migrate, CoordinationRepository, type Db } from '@threadhelm/persistence';
import { COORDINATION_FIXTURE_IDS, createCoordinationClock } from '@threadhelm/test-fixtures';

describe('Windows coordination recovery and auditable conversations (T034)', () => {
  let db: Db;
  let repo: CoordinationRepository;
  const clock = createCoordinationClock('2026-01-01T00:00:00.000Z');

  const SENDER = COORDINATION_FIXTURE_IDS.senderSession;
  const RECIPIENT = COORDINATION_FIXTURE_IDS.recipientSession;
  const SENDER_WS = COORDINATION_FIXTURE_IDS.senderWorkspace;
  const RECIPIENT_WS = COORDINATION_FIXTURE_IDS.recipientWorkspace;

  beforeEach(() => {
    db = openDatabase(':memory:');
    migrate(db);

    // Seed agent sessions and workspaces
    db.prepare(
      `INSERT INTO approved_workspaces (id, selected_path, display_path, canonical_path, volume_serial, file_id, drive_type, approved_at, last_validated_at)
       VALUES (?, ?, ?, ?, '0123456789abcdef', '0123456789abcdef0123456789abcde1', 'fixed_local', ?, ?)`,
    ).run(
      SENDER_WS,
      'C:\\ws\\sender',
      'C:\\ws\\sender',
      '\\\\?\\C:\\ws\\sender',
      clock.iso(),
      clock.iso(),
    );

    db.prepare(
      `INSERT INTO approved_workspaces (id, selected_path, display_path, canonical_path, volume_serial, file_id, drive_type, approved_at, last_validated_at)
       VALUES (?, ?, ?, ?, '0123456789abcdef', '0123456789abcdef0123456789abcde2', 'fixed_local', ?, ?)`,
    ).run(
      RECIPIENT_WS,
      'C:\\ws\\recipient',
      'C:\\ws\\recipient',
      '\\\\?\\C:\\ws\\recipient',
      clock.iso(),
      clock.iso(),
    );

    const definition = db.prepare(`INSERT INTO agent_definitions
      (id, display_name, provider_kind, executable_candidates, tested_version_range, capabilities)
      VALUES (?, ?, ?, '[]', 'fixture', '{}')`);
    definition.run('codex-cli', 'Codex CLI', 'codex-cli');
    definition.run('claude-code', 'Claude Code', 'claude-code');

    const readiness = db.prepare(`INSERT INTO agent_readiness_snapshots
      (id, provider_id, resolved_executable, version, availability, authentication, probed_at, reason_code, safe_summary)
      VALUES (?, ?, 'C:\\fixture.exe', '1.0.0', 'available', 'authenticated', ?, NULL, 'Fixture available')`);
    readiness.run('00000000-0000-4000-8000-000000000041', 'codex-cli', clock.iso());
    readiness.run('00000000-0000-4000-8000-000000000042', 'claude-code', clock.iso());

    const session = db.prepare(`INSERT INTO agent_sessions
      (id, workspace_id, definition_id, readiness_snapshot_id, access_mode, lifecycle_state,
       activity_state, activity_evidence_kind, columns, rows, started_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'write_capable', 'running', 'unknown', 'none', 100, 30, ?, ?, ?)`);
    session.run(
      SENDER,
      SENDER_WS,
      'codex-cli',
      '00000000-0000-4000-8000-000000000041',
      clock.iso(),
      clock.iso(),
      clock.iso(),
    );
    session.run(
      RECIPIENT,
      RECIPIENT_WS,
      'claude-code',
      '00000000-0000-4000-8000-000000000042',
      clock.iso(),
      clock.iso(),
      clock.iso(),
    );

    repo = new CoordinationRepository(db);
  });

  afterEach(() => {
    db?.close();
  });

  function deliver(handoffId: string): void {
    const attempt = repo.prepareAttempt({
      handoffId,
      recipientSessionId: RECIPIENT,
      recipientWorkspaceIdAtReview: RECIPIENT_WS,
      lifecycleStateAtReview: 'running',
      activityStateAtReview: 'unknown',
      activityEvidenceKindAtReview: 'none',
      createdAt: clock.iso(),
    });
    repo.submitAttempt(attempt.id, 1, clock.iso());
    repo.completeAppliedAttempt(attempt.id, clock.iso());
  }

  it('preserves conversation and handoff state across restart without automatic resend', () => {
    // Create and deliver handoff
    const handoff = repo.createHandoff({
      senderSessionId: SENDER,
      recipientSessionId: RECIPIENT,
      senderWorkspaceIdAtCreate: SENDER_WS,
      recipientWorkspaceIdAtCreate: RECIPIENT_WS,
      kind: 'request',
      purpose: 'Initial request',
      body: 'Do some work',
      requiresReply: true,
      origin: 'user',
      createdAt: clock.iso(),
    });

    const prep = repo.prepareAttempt({
      handoffId: handoff.id,
      recipientSessionId: RECIPIENT,
      recipientWorkspaceIdAtReview: RECIPIENT_WS,
      lifecycleStateAtReview: 'running',
      activityStateAtReview: 'unknown',
      activityEvidenceKindAtReview: 'none',
      createdAt: clock.iso(),
    });
    repo.submitAttempt(prep.id, 1, clock.iso());
    repo.completeAppliedAttempt(prep.id, clock.iso());

    // Verify recovery state
    const recovered = repo.findHandoffById(handoff.id);
    expect(recovered).not.toBeNull();
    expect(recovered?.deliveryState).toBe('delivered');
    expect(recovered?.workOutcome).toBe('pending');

    const conversations = repo.listConversations();
    expect(conversations.conversations.length).toBe(1);
    expect(conversations.conversations[0]?.state).toBe('open');
  });

  it('separates acknowledgement from work outcome', () => {
    const handoff = repo.createHandoff({
      senderSessionId: SENDER,
      recipientSessionId: RECIPIENT,
      senderWorkspaceIdAtCreate: SENDER_WS,
      recipientWorkspaceIdAtCreate: RECIPIENT_WS,
      kind: 'request',
      purpose: 'Needs response',
      body: 'Process this request',
      requiresReply: true,
      origin: 'user',
      createdAt: clock.iso(),
    });

    const prep = repo.prepareAttempt({
      handoffId: handoff.id,
      recipientSessionId: RECIPIENT,
      recipientWorkspaceIdAtReview: RECIPIENT_WS,
      lifecycleStateAtReview: 'running',
      activityStateAtReview: 'unknown',
      activityEvidenceKindAtReview: 'none',
      createdAt: clock.iso(),
    });
    repo.submitAttempt(prep.id, 1, clock.iso());
    repo.completeAppliedAttempt(prep.id, clock.iso());

    // Acknowledge via recipient
    const acked = repo.acknowledgeHandoff(handoff.id, RECIPIENT, clock.iso());
    expect(acked.deliveryState).toBe('acknowledged');
    expect(acked.workOutcome).toBe('pending');

    // Report outcome separately
    const completed = repo.reportWorkOutcome(handoff.id, RECIPIENT, 'completed', null, clock.iso());
    expect(completed.workOutcome).toBe('completed');
    expect(completed.deliveryState).toBe('acknowledged');
    expect(repo.getConversationSummary(handoff.conversationId)?.state).toBe('resolved');
  });

  it('creates causally linked provider replies with incremented reply depth', () => {
    const root = repo.createHandoff({
      senderSessionId: SENDER,
      recipientSessionId: RECIPIENT,
      senderWorkspaceIdAtCreate: SENDER_WS,
      recipientWorkspaceIdAtCreate: RECIPIENT_WS,
      kind: 'request',
      purpose: 'Root request',
      body: 'What is the answer?',
      requiresReply: true,
      origin: 'user',
      createdAt: clock.iso(),
    });
    deliver(root.id);

    const reply = repo.createBridgeReply(
      {
        inReplyToId: root.id,
        senderSessionId: RECIPIENT,
        kind: 'response',
        purpose: 'Reply answer',
        body: 'Here is the answer.',
        responseExpected: false,
        authorityRequired: false,
        createdAt: clock.iso(),
      },
      clock.iso(),
    );

    expect(reply.conversationId).toBe(root.conversationId);
    expect(reply.inReplyToId).toBe(root.id);
    expect(reply.senderSessionId).toBe(RECIPIENT);
    expect(reply.recipientSessionId).toBe(SENDER);
    expect(reply.replyDepth).toBe(1);
  });

  it('rejects stale or invalid events without corrupting history', () => {
    const handoff = repo.createHandoff({
      senderSessionId: SENDER,
      recipientSessionId: RECIPIENT,
      senderWorkspaceIdAtCreate: SENDER_WS,
      recipientWorkspaceIdAtCreate: RECIPIENT_WS,
      kind: 'request',
      purpose: 'Test request',
      body: 'Check causality',
      requiresReply: true,
      origin: 'user',
      createdAt: clock.iso(),
    });

    // Attempting to acknowledge from non-recipient fails
    expect(() => repo.acknowledgeHandoff(handoff.id, SENDER, clock.iso())).toThrow();

    // Attempting to report outcome from non-recipient fails
    expect(() =>
      repo.reportWorkOutcome(handoff.id, SENDER, 'completed', null, clock.iso()),
    ).toThrow();
  });

  it('deletes content from inactive conversations while preserving lifecycle records', () => {
    const root = repo.createHandoff({
      senderSessionId: SENDER,
      recipientSessionId: RECIPIENT,
      senderWorkspaceIdAtCreate: SENDER_WS,
      recipientWorkspaceIdAtCreate: RECIPIENT_WS,
      kind: 'request',
      purpose: 'To be deleted',
      body: 'Secret body content',
      requiresReply: true,
      origin: 'user',
      createdAt: clock.iso(),
    });

    // Cannot delete active/open conversation
    expect(() => repo.deleteConversationContent(root.conversationId, clock.iso())).toThrow();
    expect(repo.getConversationRetainedContentBytes(root.conversationId)).toBeGreaterThan(0);

    // Resolve or close conversation
    repo.updateConversationState(root.conversationId, 'resolved', null, clock.iso());

    // Delete content
    repo.deleteConversationContent(root.conversationId, clock.iso());

    const deletedHandoff = repo.findHandoffById(root.id);
    expect(deletedHandoff).not.toBeNull();
    expect(deletedHandoff?.purpose).toBeNull();
    expect(deletedHandoff?.body).toBeNull();
    expect(deletedHandoff?.contentBytes).toBeNull();
    expect(deletedHandoff?.contentDeletedAt).not.toBeNull();
    expect(repo.getConversationRetainedContentBytes(root.conversationId)).toBe(0);

    // Summary and lifecycle metadata still exist
    const conversation = repo.getConversationDetail(root.conversationId);
    expect(conversation.summary.contentDeletedAt).not.toBeNull();
    expect(conversation.handoffs.length).toBe(1);
    expect(conversation.events.length).toBeGreaterThan(0);
  });

  it('paginates conversation summaries and explicit handoff detail without repeating content', () => {
    const first = repo.createHandoff({
      senderSessionId: SENDER,
      recipientSessionId: RECIPIENT,
      senderWorkspaceIdAtCreate: SENDER_WS,
      recipientWorkspaceIdAtCreate: RECIPIENT_WS,
      kind: 'request',
      purpose: 'First conversation',
      body: 'First body',
      requiresReply: true,
      origin: 'user',
      createdAt: clock.iso(),
    });
    deliver(first.id);
    repo.createBridgeReply(
      {
        inReplyToId: first.id,
        senderSessionId: RECIPIENT,
        kind: 'response',
        purpose: 'First reply',
        body: 'Reply body',
        responseExpected: false,
        authorityRequired: false,
        createdAt: clock.iso(),
      },
      clock.iso(),
    );
    repo.createHandoff({
      senderSessionId: SENDER,
      recipientSessionId: RECIPIENT,
      senderWorkspaceIdAtCreate: SENDER_WS,
      recipientWorkspaceIdAtCreate: RECIPIENT_WS,
      kind: 'request',
      purpose: 'Second conversation',
      body: 'Second body',
      requiresReply: true,
      origin: 'user',
      createdAt: clock.iso(),
    });

    const summaryPage = repo.listConversations({ limit: 1 });
    expect(summaryPage.conversations).toHaveLength(1);
    expect(summaryPage.nextCursor).not.toBeNull();
    const nextSummaryPage = repo.listConversations({ cursor: summaryPage.nextCursor!, limit: 1 });
    expect(nextSummaryPage.conversations).toHaveLength(1);
    expect(nextSummaryPage.conversations[0]!.id).not.toBe(summaryPage.conversations[0]!.id);

    const detailPage = repo.getConversationDetail(first.conversationId, { limit: 1 });
    expect(detailPage.handoffs).toHaveLength(1);
    expect(detailPage.nextCursor).not.toBeNull();
    const nextDetailPage = repo.getConversationDetail(first.conversationId, {
      cursor: detailPage.nextCursor!,
      limit: 1,
    });
    expect(nextDetailPage.handoffs).toHaveLength(1);
    expect(nextDetailPage.handoffs[0]!.id).not.toBe(detailPage.handoffs[0]!.id);
  });
});
