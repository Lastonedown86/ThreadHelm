import {
  AutoContinueDisclosureView,
  ConfirmAutoContinueRequest,
  BoundedCoordinationCursor,
  ConversationId,
  ConversationState,
  CoordinationEventEnvelope,
  CoordinationEventKind,
  CoordinationSafeError,
  CancelHandoffRequest,
  ConfirmHandoffRequest,
  ConfirmPresentationRequest,
  DeliveryAttemptId,
  DeliveryAttemptState,
  DeliveryState,
  ErrorCode,
  EscalationDisposition,
  EscalationView,
  HandoffId,
  HandoffKind,
  HandoffListView,
  HandoffSummaryView,
  HandoffOrigin,
  HandoffPreviewView,
  PreviewAutoContinueRequest,
  PresentationDisclosureView,
  PreviewHandoffRequest,
  PreviewRetargetRequest,
  ConfirmRetargetRequest,
  ResolveEscalationRequest,
  WorkOutcome,
  boundedPageRequest,
  operationNames,
} from '@threadhelm/contracts';
import { CoordinationDisclosureStore } from '../../apps/desktop/src/main/coordination/disclosures.js';
import { describe, expect, it } from 'vitest';
import { createWorld, identity } from './helpers/fake-context.js';

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';
const AT = '2026-08-28T12:00:00.000Z';

describe('shared coordination identifiers and enums', () => {
  it('accepts stable UUID identities and rejects non-UUID identities', () => {
    expect(ConversationId.parse(ID_A)).toBe(ID_A);
    expect(HandoffId.parse(ID_A)).toBe(ID_A);
    expect(DeliveryAttemptId.parse(ID_A)).toBe(ID_A);
    expect(() => ConversationId.parse('display-name-or-pid')).toThrow();
  });

  it('keeps coordination state vocabularies closed', () => {
    expect(ConversationState.options).toEqual(['open', 'paused', 'resolved', 'closed']);
    expect(HandoffKind.options).toEqual([
      'request',
      'query',
      'proposal',
      'inform',
      'response',
      'completion',
      'refusal',
      'failure',
    ]);
    expect(HandoffOrigin.options).toEqual(['user', 'provider_bridge', 'threadhelm']);
    expect(DeliveryState.options).toContain('manual_actionable');
    expect(DeliveryAttemptState.options).toEqual([
      'prepared',
      'dispatching',
      'applied',
      'failed_before_write',
      'unknown',
    ]);
    expect(WorkOutcome.options).toContain('escalated');
  });
});

describe('bounded coordination pagination', () => {
  it('uses an opaque bounded cursor and caller-specific limit', () => {
    const schema = boundedPageRequest(100);
    expect(schema.parse({ cursor: 'opaque:cursor:1', limit: 100 })).toEqual({
      cursor: 'opaque:cursor:1',
      limit: 100,
    });
    expect(() => schema.parse({ cursor: 'x'.repeat(513), limit: 10 })).toThrow();
    expect(() => schema.parse({ limit: 0 })).toThrow();
    expect(() => schema.parse({ limit: 101 })).toThrow();
    expect(() => schema.parse({ limit: 10, body: 'must not cross list IPC' })).toThrow();
  });

  it('strictly validates a deterministic keyset cursor payload', () => {
    expect(BoundedCoordinationCursor.parse({ occurredAt: AT, id: ID_A, sequence: 3 })).toEqual({
      occurredAt: AT,
      id: ID_A,
      sequence: 3,
    });
    expect(() =>
      BoundedCoordinationCursor.parse({ occurredAt: AT, id: ID_A, sequence: 3, extra: true }),
    ).toThrow();
  });
});

describe('coordination errors and events', () => {
  it('exposes stable coordination errors in a strict sanitized envelope', () => {
    expect(ErrorCode.parse('COORDINATION_TARGET_CHANGED')).toBe('COORDINATION_TARGET_CHANGED');
    expect(
      CoordinationSafeError.parse({
        code: 'COORDINATION_TARGET_CHANGED',
        message: 'The reviewed recipient changed.',
        reasonCode: 'TARGET_SNAPSHOT_CHANGED',
      }),
    ).toEqual({
      code: 'COORDINATION_TARGET_CHANGED',
      message: 'The reviewed recipient changed.',
      reasonCode: 'TARGET_SNAPSHOT_CHANGED',
    });
    expect(() =>
      CoordinationSafeError.parse({
        code: 'COORDINATION_TARGET_CHANGED',
        message: 'The reviewed recipient changed.',
        reasonCode: 'TARGET_SNAPSHOT_CHANGED',
        stack: 'raw stack',
      }),
    ).toThrow();
  });

  it('accepts content-free events and rejects purpose/body/credentials', () => {
    const event = {
      type: 'coordination.handoffChanged' as const,
      eventId: ID_A,
      conversationId: ID_B,
      handoffId: ID_A,
      sequence: 1,
      kind: 'queued' as const,
      reasonCode: null,
      safeSummary: 'Handoff queued',
      occurredAt: AT,
    };
    expect(CoordinationEventKind.parse('queued')).toBe('queued');
    expect(CoordinationEventEnvelope.parse(event)).toEqual(event);
    for (const extra of [
      { body: 'durable content' },
      { purpose: 'secret purpose' },
      { credential: 'pipe-token' },
    ]) {
      expect(() => CoordinationEventEnvelope.parse({ ...event, ...extra })).toThrow();
    }
  });
});

describe('US1 directed-handoff contracts', () => {
  it('fuzzes unsafe content and role fields through the real main IPC handler without durable effects', async () => {
    const world = createWorld();
    world.addDir('C:\\projects\\fuzz-a', identity(801));
    world.addDir('C:\\projects\\fuzz-b', identity(802));
    const a = await world.approve('C:\\projects\\fuzz-a');
    const b = await world.approve('C:\\projects\\fuzz-b');
    const source = await world.launch(a.id);
    const recipient = await world.launch(b.id);
    const base = {
      sourceSessionId: source.id,
      recipientSessionId: recipient.id,
      kind: 'request',
      purpose: 'Review',
      body: 'Bounded work',
      responseExpected: true,
    };
    for (const body of [
      '\ud800',
      '\udfff',
      '\u001b]52;c;synthetic\u0007',
      '\u009b31m',
      'API_TOKEN=synthetic',
      '界'.repeat(5_462),
    ]) {
      const result = await world.call('coordination.previewHandoff', { ...base, body });
      expect(result.ok, JSON.stringify(body).slice(0, 80)).toBe(false);
      expect(JSON.stringify(result)).not.toContain(body);
    }
    for (const extra of [
      { role: 'supervisor' },
      { workspaceId: a.id },
      { authority: 'approved' },
      { recipientSessionId: [recipient.id] },
    ]) {
      expect((await world.call('coordination.previewHandoff', { ...base, ...extra })).ok).toBe(
        false,
      );
    }
    expect(
      world.ctx.storage!.db.prepare('SELECT count(*) AS count FROM coordination_handoffs').get(),
    ).toEqual({ count: 0 });
  });

  const previewRequest = {
    sourceSessionId: ID_A,
    recipientSessionId: ID_B,
    kind: 'request' as const,
    purpose: 'Review the coordination change',
    body: 'Check exact-recipient and recovery behavior.',
    responseExpected: true,
  };

  it('accepts one exact recipient and rejects unknown, array, and self targets', () => {
    expect(PreviewHandoffRequest.parse(previewRequest)).toEqual(previewRequest);
    expect(() => PreviewHandoffRequest.parse({ ...previewRequest, hidden: 'field' })).toThrow();
    expect(() =>
      PreviewHandoffRequest.parse({
        ...previewRequest,
        recipientSessionId: [ID_B, '33333333-3333-4333-8333-333333333333'],
      }),
    ).toThrow();
    expect(() =>
      PreviewHandoffRequest.parse({ ...previewRequest, recipientSessionId: ID_A }),
    ).toThrow();
  });

  it('bounds the restart-safe US1 handoff list without exposing internal rows', () => {
    expect(HandoffListView.parse({ handoffs: [], storageDegraded: false })).toEqual({
      handoffs: [],
      storageDegraded: false,
    });
    expect(() =>
      HandoffListView.parse({ handoffs: [], storageDegraded: false, sqlitePath: 'private' }),
    ).toThrow();
    expect(() =>
      HandoffSummaryView.parse({
        id: ID_A,
        conversationId: ID_B,
        inReplyToId: null,
        senderSessionId: ID_A,
        recipientSessionId: ID_B,
        origin: 'user',
        kind: 'request',
        responseExpected: true,
        deliveryState: 'queued',
        workOutcome: 'pending',
        holdReasonCode: null,
        purpose: 'must remain behind explicit detail',
        body: 'must remain behind explicit detail',
        createdAt: AT,
        updatedAt: AT,
        deliveredAt: null,
        acknowledgedAt: null,
      }),
    ).toThrow();
  });

  it('returns the exact normalized durable content and target snapshot in preview only', () => {
    const view = {
      previewToken: 'p'.repeat(24),
      sourceSessionId: ID_A,
      recipientSessionId: ID_B,
      sourceWorkspaceId: ID_A,
      recipientWorkspaceId: ID_B,
      kind: 'request' as const,
      normalizedPurpose: previewRequest.purpose,
      normalizedBody: previewRequest.body,
      responseExpected: true,
      retainedContentBytes: 42,
      persistenceDisclosure: 'This handoff content will be stored locally.',
      expiresAt: AT,
    };
    expect(HandoffPreviewView.parse(view)).toEqual(view);
    expect(() => HandoffPreviewView.parse({ ...view, providerPayload: 'raw' })).toThrow();
  });

  it('requires explicit handoff persistence and presentation submission confirmations', () => {
    expect(
      ConfirmHandoffRequest.parse({ previewToken: 'p'.repeat(24), persistenceConfirmation: true }),
    ).toEqual({ previewToken: 'p'.repeat(24), persistenceConfirmation: true });
    expect(() =>
      ConfirmHandoffRequest.parse({ previewToken: 'p'.repeat(24), persistenceConfirmation: false }),
    ).toThrow();
    expect(
      ConfirmPresentationRequest.parse({
        presentationToken: 's'.repeat(24),
        submitConfirmation: true,
      }),
    ).toEqual({ presentationToken: 's'.repeat(24), submitConfirmation: true });
  });

  it('binds presentation disclosure to selected recipient, workspace, state, and exact envelope', () => {
    const disclosure = {
      presentationToken: 's'.repeat(24),
      handoffId: ID_A,
      recipientSessionId: ID_B,
      recipientWorkspaceId: ID_B,
      selectedSessionId: ID_B,
      lifecycleState: 'running' as const,
      activityState: 'unknown' as const,
      activityEvidenceKind: 'none',
      activityObservedAt: null,
      terminalEnvelope: '[ThreadHelm handoff]\nID: 11111111\n\nBody',
      manualRisk: 'The recipient may already have an active draft.',
      expiresAt: AT,
    };
    expect(PresentationDisclosureView.parse(disclosure)).toEqual(disclosure);
    expect(() =>
      PresentationDisclosureView.parse({ ...disclosure, body: 'duplicate leak' }),
    ).toThrow();
  });

  it('uses one-use snapshot tokens so replay and target drift fail closed', () => {
    const store = new CoordinationDisclosureStore(() => Date.parse(AT));
    const snapshot = { handoffId: ID_A, recipientSessionId: ID_B, workspaceId: ID_B };
    const replay = store.issue('handoff.persist', snapshot);
    expect(store.take(replay.token, 'handoff.persist', snapshot)).toEqual(snapshot);
    expect(store.take(replay.token, 'handoff.persist', snapshot)).toBeNull();

    const drift = store.issue('handoff.present', snapshot);
    expect(
      store.take(drift.token, 'handoff.present', { ...snapshot, workspaceId: ID_A }),
    ).toBeNull();
  });

  it('strictly contracts cancellation and reviewed retargeting', () => {
    expect(CancelHandoffRequest.parse({ handoffId: ID_A })).toEqual({ handoffId: ID_A });
    expect(PreviewRetargetRequest.parse({ handoffId: ID_A, recipientSessionId: ID_B })).toEqual({
      handoffId: ID_A,
      recipientSessionId: ID_B,
    });
    expect(
      ConfirmRetargetRequest.parse({ retargetToken: 'r'.repeat(24), retargetConfirmation: true }),
    ).toEqual({ retargetToken: 'r'.repeat(24), retargetConfirmation: true });
    expect(() =>
      ConfirmRetargetRequest.parse({ retargetToken: 'r'.repeat(24), retargetConfirmation: false }),
    ).toThrow();
  });
});

describe('US2 outcome authority boundary', () => {
  it('does not expose provider work-outcome mutation to the renderer IPC surface', () => {
    expect(operationNames).not.toContain('coordination.reportOutcome');
  });
});

describe('US4 bounded-continuation contracts', () => {
  it('binds automatic continuation to an exact reviewed conversation disclosure', () => {
    expect(PreviewAutoContinueRequest.parse({ conversationId: ID_A, enabled: true })).toEqual({
      conversationId: ID_A,
      enabled: true,
    });
    expect(() =>
      PreviewAutoContinueRequest.parse({ conversationId: ID_A, enabled: true, inferred: true }),
    ).toThrow();

    const disclosure = {
      autoContinueToken: 'a'.repeat(24),
      conversationId: ID_A,
      participantSessionIds: [ID_A, ID_B],
      currentEnabled: false,
      requestedEnabled: true,
      replyDepthLimit: 8,
      equivalentRepeatThreshold: 3,
      equivalentRepeatWindow: 8,
      deliveryFailureThreshold: 3,
      heldKinds: ['request', 'query', 'proposal'],
      authorityDisclosure:
        'Automatic continuation cannot grant destructive, privileged, external, or expanded authority.',
      expiresAt: AT,
    };
    expect(AutoContinueDisclosureView.parse(disclosure)).toEqual(disclosure);
    expect(() =>
      AutoContinueDisclosureView.parse({ ...disclosure, body: 'must not leak' }),
    ).toThrow();

    expect(
      ConfirmAutoContinueRequest.parse({
        autoContinueToken: 'a'.repeat(24),
        autoContinueConfirmation: true,
      }),
    ).toEqual({ autoContinueToken: 'a'.repeat(24), autoContinueConfirmation: true });
    expect(() =>
      ConfirmAutoContinueRequest.parse({
        autoContinueToken: 'a'.repeat(24),
        autoContinueConfirmation: false,
      }),
    ).toThrow();
  });

  it('exposes one content-free escalation and requires an exact one-use disposition', () => {
    const escalation = {
      id: ID_A,
      conversationId: ID_B,
      handoffId: ID_A,
      kind: 'authority_required' as const,
      state: 'open' as const,
      reasonCode: 'AUTHORITY_REQUIRED',
      safeSummary: 'User direction required',
      openedAt: AT,
      resolvedAt: null,
      resolution: null,
    };
    expect(EscalationView.parse(escalation)).toEqual(escalation);
    expect(() => EscalationView.parse({ ...escalation, body: 'secret request' })).toThrow();
    expect(EscalationDisposition.options).toEqual(['continue', 'redirect', 'close']);

    expect(ResolveEscalationRequest.parse({ escalationId: ID_A, disposition: 'continue' })).toEqual(
      { escalationId: ID_A, disposition: 'continue' },
    );
    expect(
      ResolveEscalationRequest.parse({
        escalationId: ID_A,
        disposition: 'redirect',
        recipientSessionId: ID_B,
      }),
    ).toEqual({ escalationId: ID_A, disposition: 'redirect', recipientSessionId: ID_B });
    expect(() =>
      ResolveEscalationRequest.parse({ escalationId: ID_A, disposition: 'redirect' }),
    ).toThrow();
    expect(() =>
      ResolveEscalationRequest.parse({
        escalationId: ID_A,
        disposition: 'close',
        recipientSessionId: ID_B,
      }),
    ).toThrow();
  });

  it('registers only the named preview, confirm, and escalation operations', () => {
    expect(operationNames).toContain('coordination.previewAutoContinue');
    expect(operationNames).toContain('coordination.confirmAutoContinue');
    expect(operationNames).toContain('coordination.resolveEscalation');
    expect(operationNames).not.toContain('coordination.setAutoContinueUnchecked');
  });
});
