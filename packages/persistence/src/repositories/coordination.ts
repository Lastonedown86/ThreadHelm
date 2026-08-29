/** Durable coordination repository (Feature 002, US1). Electron main is its sole caller. */

import { createHash, randomUUID } from 'node:crypto';
import {
  ThreadHelmError,
  ReasonCode,
  ConversationSummaryView,
  CoordinationEventEnvelope,
  HandoffView,
  type ActivityState,
  type ConversationDetailView,
  type ConversationState,
  type CoordinationEventKind,
  type DeliveryAttemptState,
  type DeliveryState,
  type HandoffKind,
  type HandoffOrigin,
  type LifecycleState,
  type WorkOutcome,
} from '@threadhelm/contracts';
import {
  advanceDeliveryAttemptState,
  advanceDeliveryState,
  advanceWorkOutcome,
  canTransitionDelivery,
} from '@threadhelm/domain';

import type { Db } from '../migrate.js';
import {
  coordinationSafeSummary,
  sanitizeCoordinationBody,
  sanitizeCoordinationPurpose,
} from '../sanitize.js';

export const MAX_RETAINED_COORDINATION_BYTES = 64 * 1024 * 1024;
export const MAX_ACTIVE_COORDINATION_CONVERSATIONS = 100;
export const MAX_HANDOFFS_PER_CONVERSATION = 128;

export interface CoordinationHandoffRecord {
  id: string;
  conversationId: string;
  inReplyToId: string | null;
  senderSessionId: string;
  recipientSessionId: string;
  senderWorkspaceIdAtCreate: string;
  recipientWorkspaceIdAtCreate: string;
  origin: HandoffOrigin;
  kind: HandoffKind;
  requiresReply: boolean;
  purpose: string | null;
  body: string | null;
  contentBytes: number | null;
  replyDepth: number;
  deliveryState: DeliveryState;
  workOutcome: WorkOutcome;
  holdReasonCode: string | null;
  createdAt: string;
  updatedAt: string;
  deliveredAt: string | null;
  acknowledgedAt: string | null;
  contentDeletedAt: string | null;
}

interface HandoffRow {
  id: string;
  conversation_id: string;
  in_reply_to_id: string | null;
  sender_session_id: string;
  recipient_session_id: string;
  sender_workspace_id_at_create: string;
  recipient_workspace_id_at_create: string;
  origin: HandoffOrigin;
  kind: HandoffKind;
  requires_reply: number;
  purpose: string | null;
  body: string | null;
  content_bytes: number | null;
  reply_depth: number;
  delivery_state: DeliveryState;
  work_outcome: WorkOutcome;
  hold_reason_code: string | null;
  created_at: string;
  updated_at: string;
  delivered_at: string | null;
  acknowledged_at: string | null;
  content_deleted_at: string | null;
}

interface ConversationRow {
  id: string;
  state: ConversationState;
  root_handoff_id: string;
  auto_continue_enabled: number;
  pause_reason_code: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  content_deleted_at: string | null;
}

const toHandoff = (row: HandoffRow): CoordinationHandoffRecord => ({
  id: row.id,
  conversationId: row.conversation_id,
  inReplyToId: row.in_reply_to_id,
  senderSessionId: row.sender_session_id,
  recipientSessionId: row.recipient_session_id,
  senderWorkspaceIdAtCreate: row.sender_workspace_id_at_create,
  recipientWorkspaceIdAtCreate: row.recipient_workspace_id_at_create,
  origin: row.origin,
  kind: row.kind,
  requiresReply: row.requires_reply === 1,
  purpose: row.purpose,
  body: row.body,
  contentBytes: row.content_bytes,
  replyDepth: row.reply_depth,
  deliveryState: row.delivery_state,
  workOutcome: row.work_outcome,
  holdReasonCode: row.hold_reason_code,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deliveredAt: row.delivered_at,
  acknowledgedAt: row.acknowledged_at,
  contentDeletedAt: row.content_deleted_at,
});

export interface CreateHandoffInput {
  id?: string;
  conversationId?: string;
  inReplyToId?: string | null;
  senderSessionId: string;
  recipientSessionId: string;
  senderWorkspaceIdAtCreate: string;
  recipientWorkspaceIdAtCreate: string;
  origin: HandoffOrigin;
  kind: HandoffKind;
  requiresReply: boolean;
  purpose: string;
  body: string;
  deliveryState?: Extract<DeliveryState, 'queued' | 'held' | 'manual_actionable'>;
  holdReasonCode?: string | null;
  createdAt: string;
}

export interface CreateBridgeReplyInput {
  inReplyToId: string;
  senderSessionId: string;
  kind: HandoffKind;
  purpose: string;
  body: string;
  responseExpected?: boolean;
  authorityRequired?: boolean;
  createdAt?: string;
}

export interface DeliveryAttemptRecord {
  id: string;
  handoffId: string;
  attemptNumber: number;
  recipientSessionId: string;
  recipientWorkspaceIdAtReview: string;
  lifecycleStateAtReview: LifecycleState;
  activityStateAtReview: ActivityState;
  activityEvidenceKindAtReview: string;
  state: DeliveryAttemptState;
  controlSequence: number | null;
  evidenceKind: string;
  reasonCode: string | null;
  createdAt: string;
  submittedAt: string | null;
  completedAt: string | null;
}

interface AttemptRow {
  id: string;
  handoff_id: string;
  attempt_number: number;
  recipient_session_id: string;
  recipient_workspace_id_at_review: string;
  lifecycle_state_at_review: LifecycleState;
  activity_state_at_review: ActivityState;
  activity_evidence_kind_at_review: string;
  state: DeliveryAttemptState;
  control_sequence: number | null;
  evidence_kind: string;
  reason_code: string | null;
  created_at: string;
  submitted_at: string | null;
  completed_at: string | null;
}

const toAttempt = (row: AttemptRow): DeliveryAttemptRecord => ({
  id: row.id,
  handoffId: row.handoff_id,
  attemptNumber: row.attempt_number,
  recipientSessionId: row.recipient_session_id,
  recipientWorkspaceIdAtReview: row.recipient_workspace_id_at_review,
  lifecycleStateAtReview: row.lifecycle_state_at_review,
  activityStateAtReview: row.activity_state_at_review,
  activityEvidenceKindAtReview: row.activity_evidence_kind_at_review,
  state: row.state,
  controlSequence: row.control_sequence,
  evidenceKind: row.evidence_kind,
  reasonCode: row.reason_code,
  createdAt: row.created_at,
  submittedAt: row.submitted_at,
  completedAt: row.completed_at,
});

export interface PrepareAttemptInput {
  id?: string;
  handoffId: string;
  recipientSessionId: string;
  recipientWorkspaceIdAtReview: string;
  lifecycleStateAtReview: LifecycleState;
  activityStateAtReview: ActivityState;
  activityEvidenceKindAtReview: string;
  evidenceKind?: string;
  presentationActor?: 'user' | 'threadhelm' | 'provider';
  createdAt: string;
}

export interface MarkOldestQueuedManualActionableInput {
  recipientSessionId: string;
  reasonCode: string;
  actor: 'threadhelm' | 'provider';
  at: string;
}

export interface MarkQueuedManualActionableInput {
  recipientSessionId: string;
  reasonCode: string;
  actor: 'threadhelm' | 'provider';
  at: string;
}

export interface CoordinationEventRecord {
  id: string;
  conversationId: string;
  handoffId: string | null;
  sequence: number;
  kind: CoordinationEventKind;
  reasonCode: string | null;
  safeSummary: string;
  occurredAt: string;
}

interface CoordinationEventRow {
  id: string;
  conversation_id: string;
  handoff_id: string | null;
  sequence: number;
  kind: CoordinationEventKind;
  reason_code: string | null;
  safe_summary: string;
  occurred_at: string;
}

interface SessionTargetRow {
  id: string;
  workspace_id: string;
}

interface ConversationRow {
  id: string;
  state: ConversationState;
}

export class CoordinationRepository {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  findHandoffById(id: string): CoordinationHandoffRecord | null {
    const row = this.#db.prepare('SELECT * FROM coordination_handoffs WHERE id = ?').get(id) as
      HandoffRow | undefined;
    return row ? toHandoff(row) : null;
  }

  listHandoffs(limit = 100): CoordinationHandoffRecord[] {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new ThreadHelmError('INVALID_REQUEST', 'Handoff list limit is out of bounds.');
    }
    return (
      this.#db
        .prepare('SELECT * FROM coordination_handoffs ORDER BY updated_at DESC, id DESC LIMIT ?')
        .all(limit) as HandoffRow[]
    ).map(toHandoff);
  }

  retainedContentBytes(): number {
    return (
      this.#db
        .prepare('SELECT COALESCE(SUM(content_bytes), 0) AS n FROM coordination_handoffs')
        .get() as { n: number }
    ).n;
  }

  createHandoff(input: CreateHandoffInput): CoordinationHandoffRecord {
    const id = input.id ?? randomUUID();
    const conversationId = input.conversationId ?? randomUUID();
    const purpose = sanitizeCoordinationPurpose(input.purpose);
    const body = sanitizeCoordinationBody(input.body);
    const contentBytes = purpose.utf8Bytes + body.utf8Bytes;
    const deliveryState = input.deliveryState ?? 'queued';
    const holdReasonCode = input.holdReasonCode ?? null;
    ReasonCode.parse(holdReasonCode);
    if (input.senderSessionId === input.recipientSessionId) {
      throw new ThreadHelmError('COORDINATION_NOT_ELIGIBLE', 'Sender and recipient must differ.');
    }
    if ((deliveryState === 'held' || deliveryState === 'manual_actionable') && !holdReasonCode) {
      throw new ThreadHelmError(
        'INVALID_REQUEST',
        'A held or manual-actionable handoff requires a reason code.',
      );
    }

    const existing = this.findHandoffById(id);
    if (existing) {
      if (
        existing.conversationId === conversationId &&
        existing.senderSessionId === input.senderSessionId &&
        existing.recipientSessionId === input.recipientSessionId &&
        existing.purpose === purpose.normalized &&
        existing.body === body.normalized
      ) {
        return existing;
      }
      throw new ThreadHelmError(
        'COORDINATION_CAUSALITY_INVALID',
        'The handoff identity is already bound to different content.',
      );
    }

    this.#db.transaction(() => {
      this.#assertSessionWorkspace(input.senderSessionId, input.senderWorkspaceIdAtCreate);
      this.#assertSessionWorkspace(input.recipientSessionId, input.recipientWorkspaceIdAtCreate);
      const retained = (
        this.#db
          .prepare('SELECT COALESCE(SUM(content_bytes), 0) AS n FROM coordination_handoffs')
          .get() as { n: number }
      ).n;
      if (retained + contentBytes > MAX_RETAINED_COORDINATION_BYTES) {
        throw new ThreadHelmError(
          'COORDINATION_LIMIT_REACHED',
          'The retained coordination content limit was reached.',
          { reason: 'RETAINED_CONTENT_LIMIT' },
        );
      }

      const conversation = this.#db
        .prepare('SELECT id, state FROM coordination_conversations WHERE id = ?')
        .get(conversationId) as ConversationRow | undefined;
      if (!conversation) {
        const active = (
          this.#db
            .prepare(
              "SELECT COUNT(*) AS n FROM coordination_conversations WHERE state IN ('open', 'paused')",
            )
            .get() as { n: number }
        ).n;
        if (active >= MAX_ACTIVE_COORDINATION_CONVERSATIONS) {
          throw new ThreadHelmError(
            'COORDINATION_LIMIT_REACHED',
            'The active conversation limit was reached.',
            { reason: 'ACTIVE_CONVERSATION_LIMIT' },
          );
        }
        this.#db
          .prepare(
            `INSERT INTO coordination_conversations
               (id, state, auto_continue_enabled, auto_reply_depth_limit,
                consecutive_delivery_failures, created_at, updated_at)
             VALUES (?, 'open', 0, 8, 0, ?, ?)`,
          )
          .run(conversationId, input.createdAt, input.createdAt);
      } else if (conversation.state !== 'open') {
        throw new ThreadHelmError('COORDINATION_CLOSED', 'Conversation is not open.');
      }

      const handoffCount = (
        this.#db
          .prepare('SELECT COUNT(*) AS n FROM coordination_handoffs WHERE conversation_id = ?')
          .get(conversationId) as { n: number }
      ).n;
      if (handoffCount >= MAX_HANDOFFS_PER_CONVERSATION) {
        throw new ThreadHelmError(
          'COORDINATION_LIMIT_REACHED',
          'The handoff limit for this conversation was reached.',
          { reason: 'HANDOFF_LIMIT' },
        );
      }

      let replyDepth = 0;
      if (input.inReplyToId) {
        const parent = this.findHandoffById(input.inReplyToId);
        if (
          !parent ||
          parent.conversationId !== conversationId ||
          ![parent.senderSessionId, parent.recipientSessionId].includes(input.senderSessionId) ||
          ![parent.senderSessionId, parent.recipientSessionId].includes(input.recipientSessionId)
        ) {
          throw new ThreadHelmError(
            'COORDINATION_CAUSALITY_INVALID',
            'The reply does not belong to this participant pair.',
          );
        }
        replyDepth = parent.replyDepth + 1;
      }

      const fingerprint = createHash('sha256')
        .update(
          JSON.stringify([
            input.kind,
            input.senderSessionId,
            input.recipientSessionId,
            purpose.normalized,
            body.normalized,
          ]),
        )
        .digest();
      this.#db
        .prepare(
          `INSERT INTO coordination_handoffs
             (id, conversation_id, in_reply_to_id, sender_session_id, recipient_session_id,
              sender_workspace_id_at_create, recipient_workspace_id_at_create, origin, kind,
              requires_reply, purpose, body, content_bytes, content_fingerprint, reply_depth,
              delivery_state, work_outcome, hold_reason_code, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
        )
        .run(
          id,
          conversationId,
          input.inReplyToId ?? null,
          input.senderSessionId,
          input.recipientSessionId,
          input.senderWorkspaceIdAtCreate,
          input.recipientWorkspaceIdAtCreate,
          input.origin,
          input.kind,
          input.requiresReply ? 1 : 0,
          purpose.normalized,
          body.normalized,
          contentBytes,
          fingerprint,
          replyDepth,
          deliveryState,
          holdReasonCode,
          input.createdAt,
          input.createdAt,
        );
      this.#db
        .prepare(
          'UPDATE coordination_conversations SET root_handoff_id = COALESCE(root_handoff_id, ?) WHERE id = ?',
        )
        .run(id, conversationId);
      const eventKind =
        deliveryState === 'held'
          ? 'held'
          : deliveryState === 'manual_actionable'
            ? 'recovered'
            : 'queued';
      this.#appendEvent(
        conversationId,
        id,
        eventKind,
        'user',
        holdReasonCode,
        coordinationSafeSummary(
          deliveryState === 'queued' ? 'handoff_queued' : 'delivery_changed',
          deliveryState === 'queued' ? {} : { state: deliveryState },
        ),
        input.createdAt,
      );
    })();
    return this.findHandoffById(id)!;
  }

  prepareAttempt(input: PrepareAttemptInput): DeliveryAttemptRecord {
    const id = input.id ?? randomUUID();
    const evidenceKind = input.evidenceKind ?? 'user_confirmation';
    const presentationActor = input.presentationActor ?? 'user';
    this.#db.transaction(() => {
      const handoff = this.findHandoffById(input.handoffId);
      if (!handoff) throw new ThreadHelmError('HANDOFF_NOT_FOUND', 'Handoff not found.');
      if (
        handoff.recipientSessionId !== input.recipientSessionId ||
        handoff.recipientWorkspaceIdAtCreate !== input.recipientWorkspaceIdAtReview
      ) {
        throw new ThreadHelmError('COORDINATION_TARGET_CHANGED', 'Delivery target changed.');
      }
      const blocking = this.#db
        .prepare(
          `SELECT id FROM coordination_delivery_attempts
           WHERE handoff_id = ? AND state IN ('prepared', 'dispatching', 'applied', 'unknown') LIMIT 1`,
        )
        .get(input.handoffId);
      if (blocking) {
        throw new ThreadHelmError(
          'COORDINATION_ATTEMPT_ACTIVE',
          'A delivery attempt blocks retry.',
        );
      }
      const nextDeliveryState = advanceDeliveryState(handoff.deliveryState, 'presenting');
      const attemptNumber = (
        this.#db
          .prepare(
            'SELECT COALESCE(MAX(attempt_number), 0) + 1 AS n FROM coordination_delivery_attempts WHERE handoff_id = ?',
          )
          .get(input.handoffId) as { n: number }
      ).n;
      this.#db
        .prepare(
          `INSERT INTO coordination_delivery_attempts
             (id, handoff_id, attempt_number, recipient_session_id,
              recipient_workspace_id_at_review, lifecycle_state_at_review,
              activity_state_at_review, activity_evidence_kind_at_review, state,
              evidence_kind, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'prepared', ?, ?)`,
        )
        .run(
          id,
          input.handoffId,
          attemptNumber,
          input.recipientSessionId,
          input.recipientWorkspaceIdAtReview,
          input.lifecycleStateAtReview,
          input.activityStateAtReview,
          input.activityEvidenceKindAtReview,
          evidenceKind,
          input.createdAt,
        );
      this.#db
        .prepare(
          'UPDATE coordination_handoffs SET delivery_state = ?, hold_reason_code = NULL, updated_at = ? WHERE id = ?',
        )
        .run(nextDeliveryState, input.createdAt, input.handoffId);
      this.#appendEvent(
        handoff.conversationId,
        handoff.id,
        'presentation_requested',
        presentationActor,
        null,
        'Presentation requested',
        input.createdAt,
      );
    })();
    return this.findAttemptById(id)!;
  }

  findAttemptById(id: string): DeliveryAttemptRecord | null {
    const row = this.#db
      .prepare('SELECT * FROM coordination_delivery_attempts WHERE id = ?')
      .get(id) as AttemptRow | undefined;
    return row ? toAttempt(row) : null;
  }

  listUnknownAttempts(): DeliveryAttemptRecord[] {
    return (
      this.#db
        .prepare(
          "SELECT * FROM coordination_delivery_attempts WHERE state = 'unknown' ORDER BY created_at, id",
        )
        .all() as AttemptRow[]
    ).map(toAttempt);
  }

  listInFlightAttempts(): DeliveryAttemptRecord[] {
    return (
      this.#db
        .prepare(
          "SELECT * FROM coordination_delivery_attempts WHERE state IN ('prepared', 'dispatching') ORDER BY created_at, id",
        )
        .all() as AttemptRow[]
    ).map(toAttempt);
  }

  latestEventForHandoff(handoffId: string): CoordinationEventRecord | null {
    const row = this.#db
      .prepare(
        `SELECT id, conversation_id, handoff_id, sequence, kind, reason_code, safe_summary, occurred_at
         FROM coordination_events WHERE handoff_id = ? ORDER BY sequence DESC LIMIT 1`,
      )
      .get(handoffId) as CoordinationEventRow | undefined;
    return row
      ? {
          id: row.id,
          conversationId: row.conversation_id,
          handoffId: row.handoff_id,
          sequence: row.sequence,
          kind: row.kind,
          reasonCode: row.reason_code,
          safeSummary: row.safe_summary,
          occurredAt: row.occurred_at,
        }
      : null;
  }

  markAttemptDispatching(id: string, controlSequence: number, at: string): DeliveryAttemptRecord {
    this.#db.transaction(() => {
      const current = this.findAttemptById(id);
      if (!current) {
        throw new ThreadHelmError('INVALID_STATE', 'Attempt is not prepared.');
      }
      const nextAttemptState = advanceDeliveryAttemptState(current.state, 'dispatching');
      this.#db
        .prepare(
          `UPDATE coordination_delivery_attempts
           SET state = ?, control_sequence = ?, submitted_at = ? WHERE id = ?`,
        )
        .run(nextAttemptState, controlSequence, at, id);
      const handoff = this.findHandoffById(current.handoffId)!;
      this.#appendEvent(
        handoff.conversationId,
        handoff.id,
        'dispatching',
        'threadhelm',
        null,
        'Handoff dispatching',
        at,
      );
    })();
    return this.findAttemptById(id)!;
  }

  markAttemptApplied(id: string, at: string): DeliveryAttemptRecord {
    this.#completeAttempt(id, 'applied', null, at);
    return this.findAttemptById(id)!;
  }

  markAttemptFailedBeforeWrite(id: string, reasonCode: string, at: string): DeliveryAttemptRecord {
    this.#completeAttempt(id, 'failed_before_write', reasonCode, at);
    return this.findAttemptById(id)!;
  }

  markAttemptUnknown(id: string, reasonCode: string, at: string): DeliveryAttemptRecord {
    this.#completeAttempt(id, 'unknown', reasonCode, at);
    return this.findAttemptById(id)!;
  }

  cancelHandoff(id: string, at: string): CoordinationHandoffRecord {
    const current = this.findHandoffById(id);
    if (!current) throw new ThreadHelmError('HANDOFF_NOT_FOUND', 'Handoff not found.');
    if (!canTransitionDelivery(current.deliveryState, 'cancelled')) {
      throw new ThreadHelmError(
        'COORDINATION_DELIVERY_UNKNOWN',
        'Handoff can no longer be cancelled.',
      );
    }
    const nextDeliveryState = advanceDeliveryState(current.deliveryState, 'cancelled');
    const nextWorkOutcome = advanceWorkOutcome(current.workOutcome, 'cancelled');
    this.#db.transaction(() => {
      this.#db
        .prepare(
          `UPDATE coordination_handoffs
           SET delivery_state = ?, work_outcome = ?, updated_at = ? WHERE id = ?`,
        )
        .run(nextDeliveryState, nextWorkOutcome, at, id);
      this.#appendEvent(
        current.conversationId,
        id,
        'cancelled',
        'user',
        'USER_CANCELLED',
        'Handoff cancelled',
        at,
      );
    })();
    return this.findHandoffById(id)!;
  }

  retargetHandoff(
    id: string,
    recipientSessionId: string,
    recipientWorkspaceId: string,
    at: string,
    deliveryState: Extract<DeliveryState, 'queued' | 'manual_actionable'> = 'queued',
    holdReasonCode: string | null = null,
  ): CoordinationHandoffRecord {
    const current = this.findHandoffById(id);
    if (!current) throw new ThreadHelmError('HANDOFF_NOT_FOUND', 'Handoff not found.');
    let nextDeliveryState: DeliveryState;
    try {
      // Retargeting a queued item changes its exact recipient while preserving
      // the queued state; advanceDeliveryState treats that replay as a no-op.
      const queuedState = advanceDeliveryState(current.deliveryState, 'queued');
      nextDeliveryState =
        deliveryState === 'manual_actionable'
          ? advanceDeliveryState(queuedState, 'manual_actionable')
          : queuedState;
    } catch {
      throw new ThreadHelmError(
        'COORDINATION_DELIVERY_UNKNOWN',
        'Handoff can no longer be retargeted.',
      );
    }
    ReasonCode.parse(holdReasonCode);
    if (deliveryState === 'manual_actionable' && !holdReasonCode) {
      throw new ThreadHelmError(
        'INVALID_REQUEST',
        'A manual-actionable retarget requires a reason code.',
      );
    }
    if (recipientSessionId === current.senderSessionId) {
      throw new ThreadHelmError('COORDINATION_NOT_ELIGIBLE', 'Recipient cannot be the sender.');
    }
    this.#assertSessionWorkspace(recipientSessionId, recipientWorkspaceId);
    if (recipientSessionId === current.recipientSessionId) {
      throw new ThreadHelmError('COORDINATION_NOT_ELIGIBLE', 'Recipient is unchanged.');
    }
    const blocking = this.#db
      .prepare(
        `SELECT id FROM coordination_delivery_attempts
         WHERE handoff_id = ? AND state IN ('prepared', 'dispatching', 'applied', 'unknown') LIMIT 1`,
      )
      .get(id);
    if (blocking) {
      throw new ThreadHelmError(
        'COORDINATION_DELIVERY_UNKNOWN',
        'Attempt history blocks retargeting.',
      );
    }
    this.#db.transaction(() => {
      const fingerprint = createHash('sha256')
        .update(
          JSON.stringify([
            current.kind,
            current.senderSessionId,
            recipientSessionId,
            current.purpose,
            current.body,
          ]),
        )
        .digest();
      this.#db
        .prepare(
          `UPDATE coordination_handoffs
           SET recipient_session_id = ?, recipient_workspace_id_at_create = ?,
               content_fingerprint = ?, delivery_state = ?, hold_reason_code = ?,
               updated_at = ?
           WHERE id = ?`,
        )
        .run(
          recipientSessionId,
          recipientWorkspaceId,
          fingerprint,
          nextDeliveryState,
          holdReasonCode,
          at,
          id,
        );
      this.#appendEvent(
        current.conversationId,
        id,
        'retargeted',
        'user',
        holdReasonCode ?? 'USER_RETARGETED',
        'Handoff retargeted',
        at,
      );
    })();
    return this.findHandoffById(id)!;
  }

  #completeAttempt(
    id: string,
    state: Extract<DeliveryAttemptState, 'applied' | 'failed_before_write' | 'unknown'>,
    reasonCode: string | null,
    at: string,
  ): void {
    ReasonCode.parse(reasonCode);
    this.#db.transaction(() => {
      const current = this.findAttemptById(id);
      if (!current) throw new ThreadHelmError('HANDOFF_NOT_FOUND', 'Delivery attempt not found.');
      if (current.state === state) return;
      const nextAttemptState = advanceDeliveryAttemptState(current.state, state);
      this.#db
        .prepare(
          `UPDATE coordination_delivery_attempts
           SET state = ?, reason_code = ?, completed_at = ? WHERE id = ?`,
        )
        .run(nextAttemptState, reasonCode, at, id);
      const handoff = this.findHandoffById(current.handoffId)!;
      if (state === 'applied') {
        const nextDeliveryState = advanceDeliveryState(handoff.deliveryState, 'delivered');
        this.#db
          .prepare(
            `UPDATE coordination_handoffs
             SET delivery_state = ?, delivered_at = ?, updated_at = ? WHERE id = ?`,
          )
          .run(nextDeliveryState, at, at, handoff.id);
        this.#db
          .prepare(
            'UPDATE coordination_conversations SET consecutive_delivery_failures = 0, updated_at = ? WHERE id = ?',
          )
          .run(at, handoff.conversationId);
      } else {
        const nextDeliveryState = advanceDeliveryState(handoff.deliveryState, 'manual_actionable');
        this.#db
          .prepare(
            `UPDATE coordination_handoffs
             SET delivery_state = ?, hold_reason_code = ?, updated_at = ? WHERE id = ?`,
          )
          .run(nextDeliveryState, reasonCode, at, handoff.id);
        this.#db
          .prepare(
            `UPDATE coordination_conversations
             SET consecutive_delivery_failures = consecutive_delivery_failures + 1, updated_at = ?
             WHERE id = ?`,
          )
          .run(at, handoff.conversationId);
      }
      this.#appendEvent(
        handoff.conversationId,
        handoff.id,
        state === 'applied' ? 'delivered' : 'recovered',
        'threadhelm',
        reasonCode,
        coordinationSafeSummary('delivery_changed', {
          state: state === 'applied' ? 'delivered' : 'manual_actionable',
        }),
        at,
      );
    })();
  }

  #assertSessionWorkspace(sessionId: string, workspaceId: string): void {
    const session = this.#db
      .prepare('SELECT id, workspace_id FROM agent_sessions WHERE id = ?')
      .get(sessionId) as SessionTargetRow | undefined;
    if (!session) throw new ThreadHelmError('SESSION_NOT_FOUND', 'Coordination session not found.');
    if (session.workspace_id !== workspaceId) {
      throw new ThreadHelmError('COORDINATION_TARGET_CHANGED', 'Session workspace changed.');
    }
  }

  #appendEvent(
    conversationId: string,
    handoffId: string | null,
    kind: CoordinationEventKind,
    actor: 'user' | 'threadhelm' | 'provider',
    reasonCode: string | null,
    safeSummary: string,
    occurredAt: string,
  ): void {
    ReasonCode.parse(reasonCode);
    const sequence = (
      this.#db
        .prepare(
          'SELECT COALESCE(MAX(sequence), 0) + 1 AS n FROM coordination_events WHERE conversation_id = ?',
        )
        .get(conversationId) as { n: number }
    ).n;
    this.#db
      .prepare(
        `INSERT INTO coordination_events
           (id, conversation_id, handoff_id, sequence, kind, actor, reason_code,
            safe_summary, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        conversationId,
        handoffId,
        sequence,
        kind,
        actor,
        reasonCode,
        safeSummary,
        occurredAt,
      );
  }

  submitAttempt(id: string, controlSequence: number, at?: string): DeliveryAttemptRecord {
    return this.markAttemptDispatching(id, controlSequence, at ?? new Date().toISOString());
  }

  completeAppliedAttempt(id: string, at?: string): DeliveryAttemptRecord {
    return this.markAttemptApplied(id, at ?? new Date().toISOString());
  }

  acknowledgeHandoff(
    handoffId: string,
    recipientSessionId: string,
    at?: string,
  ): CoordinationHandoffRecord {
    const timestamp = at ?? new Date().toISOString();
    return this.#db.transaction(() => {
      const handoff = this.findHandoffById(handoffId);
      if (!handoff) throw new ThreadHelmError('HANDOFF_NOT_FOUND', 'Handoff not found.');
      if (handoff.recipientSessionId !== recipientSessionId) {
        throw new ThreadHelmError(
          'COORDINATION_NOT_ELIGIBLE',
          'Caller is not the recipient session.',
        );
      }
      if (handoff.deliveryState === 'acknowledged') {
        return handoff;
      }
      if (handoff.deliveryState !== 'delivered') {
        throw new ThreadHelmError('INVALID_STATE', 'Handoff is not in delivered state.');
      }
      const nextState = advanceDeliveryState(handoff.deliveryState, 'acknowledged');
      this.#db
        .prepare(
          `UPDATE coordination_handoffs
           SET delivery_state = ?, acknowledged_at = ?, updated_at = ? WHERE id = ?`,
        )
        .run(nextState, timestamp, timestamp, handoffId);
      this.#appendEvent(
        handoff.conversationId,
        handoffId,
        'acknowledged',
        'provider',
        null,
        'Handoff acknowledged',
        timestamp,
      );
      return this.findHandoffById(handoffId)!;
    })();
  }

  createBridgeReply(input: CreateBridgeReplyInput, at?: string): CoordinationHandoffRecord {
    const timestamp = at ?? input.createdAt ?? new Date().toISOString();
    const parent = this.findHandoffById(input.inReplyToId);
    if (!parent) throw new ThreadHelmError('HANDOFF_NOT_FOUND', 'Parent handoff not found.');

    if (parent.recipientSessionId !== input.senderSessionId) {
      throw new ThreadHelmError(
        'COORDINATION_CAUSALITY_INVALID',
        'Reply sender must be parent recipient.',
      );
    }
    if (parent.deliveryState !== 'delivered' && parent.deliveryState !== 'acknowledged') {
      throw new ThreadHelmError(
        'INVALID_STATE',
        'A provider can reply only after the parent handoff is delivered.',
      );
    }

    const conversation = this.#db
      .prepare('SELECT id, state FROM coordination_conversations WHERE id = ?')
      .get(parent.conversationId) as ConversationRow | undefined;
    if (!conversation || conversation.state !== 'open') {
      throw new ThreadHelmError('COORDINATION_CLOSED', 'Conversation is not open.');
    }

    const recipientSessionId = parent.senderSessionId;
    const recipientWorkspaceId = parent.senderWorkspaceIdAtCreate;
    const senderWorkspaceId = parent.recipientWorkspaceIdAtCreate;

    let deliveryState: Extract<DeliveryState, 'queued' | 'held'> = 'queued';
    let holdReasonCode: string | null = null;

    if (input.authorityRequired || input.kind === 'query' || input.kind === 'proposal') {
      deliveryState = 'held';
      holdReasonCode = input.authorityRequired ? 'AUTHORITY_REQUIRED' : 'KIND_HELD';
    }

    const replyDepth = parent.replyDepth + 1;
    if (replyDepth > 8) {
      deliveryState = 'held';
      holdReasonCode = 'REPLY_DEPTH_LIMIT';
    }

    const responseExpected =
      input.responseExpected ?? (input.kind === 'request' || input.kind === 'query');

    return this.createHandoff({
      conversationId: parent.conversationId,
      inReplyToId: parent.id,
      senderSessionId: input.senderSessionId,
      recipientSessionId,
      senderWorkspaceIdAtCreate: senderWorkspaceId,
      recipientWorkspaceIdAtCreate: recipientWorkspaceId,
      origin: 'provider_bridge',
      kind: input.kind,
      requiresReply: responseExpected,
      purpose: input.purpose,
      body: input.body,
      deliveryState,
      holdReasonCode,
      createdAt: timestamp,
    });
  }

  reportWorkOutcome(
    handoffId: string,
    recipientSessionId: string,
    outcome: WorkOutcome,
    reasonCode?: string | null,
    at?: string,
  ): CoordinationHandoffRecord {
    const timestamp = at ?? new Date().toISOString();
    return this.#db.transaction(() => {
      const handoff = this.findHandoffById(handoffId);
      if (!handoff) throw new ThreadHelmError('HANDOFF_NOT_FOUND', 'Handoff not found.');
      if (handoff.recipientSessionId !== recipientSessionId) {
        throw new ThreadHelmError('COORDINATION_NOT_ELIGIBLE', 'Caller is not recipient session.');
      }
      if (handoff.deliveryState !== 'delivered' && handoff.deliveryState !== 'acknowledged') {
        throw new ThreadHelmError('INVALID_STATE', 'Work outcome requires a delivered handoff.');
      }
      if (handoff.workOutcome === outcome) {
        return handoff;
      }
      const nextOutcome = advanceWorkOutcome(handoff.workOutcome, outcome);
      this.#db
        .prepare('UPDATE coordination_handoffs SET work_outcome = ?, updated_at = ? WHERE id = ?')
        .run(nextOutcome, timestamp, handoffId);
      this.#appendEvent(
        handoff.conversationId,
        handoffId,
        'outcome_recorded',
        'provider',
        reasonCode ?? null,
        coordinationSafeSummary('outcome_recorded', { outcome: nextOutcome }),
        timestamp,
      );
      const unresolved = this.#db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM coordination_handoffs
           WHERE conversation_id = ? AND requires_reply = 1 AND work_outcome = 'pending'`,
        )
        .get(handoff.conversationId) as { count: number };
      if (unresolved.count === 0) {
        this.#db
          .prepare(
            `UPDATE coordination_conversations
             SET state = 'resolved', resolved_at = COALESCE(resolved_at, ?), updated_at = ?
             WHERE id = ? AND state = 'open'`,
          )
          .run(timestamp, timestamp, handoff.conversationId);
      }
      return this.findHandoffById(handoffId)!;
    })();
  }

  updateConversationState(
    conversationId: string,
    state: ConversationState,
    reasonCode?: string | null,
    at?: string,
  ): ConversationSummaryView {
    const timestamp = at ?? new Date().toISOString();
    return this.#db.transaction(() => {
      const conversation = this.#db
        .prepare('SELECT id, state FROM coordination_conversations WHERE id = ?')
        .get(conversationId) as ConversationRow | undefined;
      if (!conversation)
        throw new ThreadHelmError('CONVERSATION_NOT_FOUND', 'Conversation not found.');
      if (conversation.state === state) return this.getConversationSummary(conversationId)!;

      const resolvedAt = state === 'resolved' ? timestamp : null;
      const closedAt = state === 'closed' ? timestamp : null;
      this.#db
        .prepare(
          `UPDATE coordination_conversations
           SET state = ?, pause_reason_code = ?, resolved_at = COALESCE(resolved_at, ?),
               closed_at = COALESCE(closed_at, ?), updated_at = ?
           WHERE id = ?`,
        )
        .run(state, reasonCode ?? null, resolvedAt, closedAt, timestamp, conversationId);

      this.#appendEvent(
        conversationId,
        null,
        state === 'paused' ? 'paused' : state === 'resolved' ? 'resumed' : 'cancelled',
        'user',
        reasonCode ?? null,
        coordinationSafeSummary('conversation_changed', { state }),
        timestamp,
      );
      return this.getConversationSummary(conversationId)!;
    })();
  }

  deleteConversationContent(conversationId: string, at?: string): void {
    const timestamp = at ?? new Date().toISOString();
    this.#db.transaction(() => {
      const conversation = this.#db
        .prepare('SELECT id, state FROM coordination_conversations WHERE id = ?')
        .get(conversationId) as ConversationRow | undefined;
      if (!conversation)
        throw new ThreadHelmError('CONVERSATION_NOT_FOUND', 'Conversation not found.');
      if (conversation.state !== 'resolved' && conversation.state !== 'closed') {
        throw new ThreadHelmError('INVALID_STATE', 'Cannot delete active conversation content.');
      }
      this.#db
        .prepare(
          `UPDATE coordination_handoffs
           SET purpose = NULL, body = NULL, content_bytes = NULL, content_fingerprint = NULL,
               content_deleted_at = ?, updated_at = ?
           WHERE conversation_id = ?`,
        )
        .run(timestamp, timestamp, conversationId);
      this.#db
        .prepare(
          'UPDATE coordination_conversations SET content_deleted_at = ?, updated_at = ? WHERE id = ?',
        )
        .run(timestamp, timestamp, conversationId);
      this.#appendEvent(
        conversationId,
        null,
        'content_deleted',
        'user',
        'USER_DELETED_CONTENT',
        'Conversation content deleted',
        timestamp,
      );
    })();
  }

  listConversations(options: { state?: ConversationState; cursor?: string; limit?: number } = {}): {
    conversations: ConversationSummaryView[];
    nextCursor: string | null;
  } {
    const limit = options.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new ThreadHelmError('INVALID_REQUEST', 'Conversation page limit is out of bounds.');
    }
    const cursor = options.cursor ? decodeCursor(options.cursor) : null;
    let query = 'SELECT id FROM coordination_conversations';
    const params: (string | number)[] = [];
    const conditions: string[] = [];
    if (options.state) {
      conditions.push('state = ?');
      params.push(options.state);
    }
    if (cursor) {
      conditions.push('(updated_at < ? OR (updated_at = ? AND id < ?))');
      params.push(cursor.timestamp, cursor.timestamp, cursor.id);
    }
    if (conditions.length > 0) query += ` WHERE ${conditions.join(' AND ')}`;
    query += ' ORDER BY updated_at DESC, id DESC LIMIT ?';
    params.push(limit + 1);

    const rows = this.#db.prepare(query).all(...params) as { id: string }[];
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const summaries = items
      .map((r) => this.getConversationSummary(r.id))
      .filter((s): s is ConversationSummaryView => Boolean(s));

    const last = summaries[summaries.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.updatedAt, last.id) : null;
    return { conversations: summaries, nextCursor };
  }

  getConversationRetainedContentBytes(conversationId: string): number {
    const row = this.#db
      .prepare(
        `SELECT COALESCE(SUM(content_bytes), 0) AS total
         FROM coordination_handoffs WHERE conversation_id = ?`,
      )
      .get(conversationId) as { total: number };
    return row.total;
  }

  getConversationSummary(conversationId: string): ConversationSummaryView | null {
    const row = this.#db
      .prepare('SELECT * FROM coordination_conversations WHERE id = ?')
      .get(conversationId) as ConversationRow | undefined;
    if (!row) return null;

    const countRow = this.#db
      .prepare(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN requires_reply = 1 AND work_outcome = 'pending' THEN 1 ELSE 0 END) AS unresolved
         FROM coordination_handoffs WHERE conversation_id = ?`,
      )
      .get(conversationId) as { total: number; unresolved: number | null };

    const participantRows = this.#db
      .prepare(
        `SELECT DISTINCT sender_session_id AS sid FROM coordination_handoffs WHERE conversation_id = ?
         UNION
         SELECT DISTINCT recipient_session_id AS sid FROM coordination_handoffs WHERE conversation_id = ?`,
      )
      .all(conversationId, conversationId) as { sid: string }[];

    const participantSessionIds = participantRows.map((r) => r.sid);
    if (participantSessionIds.length === 0) {
      participantSessionIds.push('00000000-0000-4000-8000-000000000000');
    }

    return ConversationSummaryView.parse({
      id: row.id,
      state: row.state,
      rootHandoffId: row.root_handoff_id,
      participantSessionIds: participantSessionIds.slice(0, 2),
      handoffCount: countRow?.total ?? 0,
      unresolvedCount: countRow?.unresolved ?? 0,
      autoContinueEnabled: row.auto_continue_enabled === 1,
      pauseReasonCode: row.pause_reason_code,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      resolvedAt: row.resolved_at,
      closedAt: row.closed_at,
      contentDeletedAt: row.content_deleted_at,
    });
  }

  getConversationDetail(
    conversationId: string,
    options: { cursor?: string; limit?: number } = {},
  ): ConversationDetailView {
    const summary = this.getConversationSummary(conversationId);
    if (!summary) throw new ThreadHelmError('CONVERSATION_NOT_FOUND', 'Conversation not found.');

    const limit = options.limit ?? 128;
    if (!Number.isInteger(limit) || limit < 1 || limit > 128) {
      throw new ThreadHelmError('INVALID_REQUEST', 'Conversation detail limit is out of bounds.');
    }
    const cursor = options.cursor ? decodeCursor(options.cursor) : null;
    const handoffRows = this.#db
      .prepare(
        `SELECT * FROM coordination_handoffs
         WHERE conversation_id = ?
           AND (? IS NULL OR created_at > ? OR (created_at = ? AND id > ?))
         ORDER BY created_at ASC, id ASC LIMIT ?`,
      )
      .all(
        conversationId,
        cursor?.timestamp ?? null,
        cursor?.timestamp ?? null,
        cursor?.timestamp ?? null,
        cursor?.id ?? null,
        limit + 1,
      ) as HandoffRow[];
    const hasMore = handoffRows.length > limit;
    const pageRows = hasMore ? handoffRows.slice(0, limit) : handoffRows;

    const handoffs = pageRows.map((r) => {
      const h = toHandoff(r);
      return HandoffView.parse({
        id: h.id,
        conversationId: h.conversationId,
        inReplyToId: h.inReplyToId,
        senderSessionId: h.senderSessionId,
        recipientSessionId: h.recipientSessionId,
        origin: h.origin,
        kind: h.kind,
        responseExpected: h.requiresReply,
        deliveryState: h.deliveryState,
        workOutcome: h.workOutcome,
        holdReasonCode: h.holdReasonCode,
        purpose: h.purpose ?? undefined,
        body: h.body ?? undefined,
        createdAt: h.createdAt,
        updatedAt: h.updatedAt,
        deliveredAt: h.deliveredAt,
        acknowledgedAt: h.acknowledgedAt,
      });
    });

    const eventRows = this.#db
      .prepare(
        'SELECT * FROM coordination_events WHERE conversation_id = ? ORDER BY sequence ASC LIMIT 256',
      )
      .all(conversationId) as CoordinationEventRow[];

    const events = eventRows.map((r) =>
      CoordinationEventEnvelope.parse({
        type: 'coordination.handoffChanged',
        eventId: r.id,
        conversationId: r.conversation_id,
        handoffId: r.handoff_id,
        sequence: r.sequence,
        kind: r.kind,
        reasonCode: r.reason_code,
        safeSummary: r.safe_summary,
        occurredAt: r.occurred_at,
      }),
    );

    return {
      summary,
      handoffs,
      events,
      nextCursor:
        hasMore && pageRows.length > 0
          ? encodeCursor(
              pageRows[pageRows.length - 1]!.created_at,
              pageRows[pageRows.length - 1]!.id,
            )
          : null,
    };
  }

  listPendingHandoffsForSession(
    recipientSessionId: string,
    limit = 20,
  ): CoordinationHandoffRecord[] {
    const bound = Math.min(Math.max(limit, 1), 20);
    return (
      this.#db
        .prepare(
          `SELECT * FROM coordination_handoffs
           WHERE recipient_session_id = ? AND delivery_state IN ('queued', 'delivered') AND acknowledged_at IS NULL
           ORDER BY created_at ASC LIMIT ?`,
        )
        .all(recipientSessionId, bound) as HandoffRow[]
    ).map(toHandoff);
  }

  findOldestQueuedHandoffForSession(recipientSessionId: string): CoordinationHandoffRecord | null {
    const row = this.#db
      .prepare(
        `SELECT * FROM coordination_handoffs
         WHERE recipient_session_id = ? AND delivery_state = 'queued'
         ORDER BY created_at ASC, id ASC LIMIT 1`,
      )
      .get(recipientSessionId) as HandoffRow | undefined;
    return row ? toHandoff(row) : null;
  }

  markOldestQueuedManualActionable(
    input: MarkOldestQueuedManualActionableInput,
  ): CoordinationHandoffRecord | null {
    ReasonCode.parse(input.reasonCode);
    return this.#db.transaction(() => {
      const handoff = this.findOldestQueuedHandoffForSession(input.recipientSessionId);
      if (!handoff) return null;
      const nextState = advanceDeliveryState(handoff.deliveryState, 'manual_actionable');
      this.#db
        .prepare(
          `UPDATE coordination_handoffs
           SET delivery_state = ?, hold_reason_code = ?, updated_at = ? WHERE id = ?`,
        )
        .run(nextState, input.reasonCode, input.at, handoff.id);
      this.#appendEvent(
        handoff.conversationId,
        handoff.id,
        'recovered',
        input.actor,
        input.reasonCode,
        coordinationSafeSummary('delivery_changed', { state: 'manual_actionable' }),
        input.at,
      );
      return this.findHandoffById(handoff.id)!;
    })();
  }

  markAllQueuedManualActionable(
    input: MarkQueuedManualActionableInput,
  ): CoordinationHandoffRecord[] {
    ReasonCode.parse(input.reasonCode);
    return this.#db.transaction(() => {
      const handoffs = (
        this.#db
          .prepare(
            `SELECT * FROM coordination_handoffs
             WHERE recipient_session_id = ? AND delivery_state = 'queued'
             ORDER BY created_at ASC, id ASC`,
          )
          .all(input.recipientSessionId) as HandoffRow[]
      ).map(toHandoff);
      for (const handoff of handoffs) {
        const nextState = advanceDeliveryState(handoff.deliveryState, 'manual_actionable');
        this.#db
          .prepare(
            `UPDATE coordination_handoffs
             SET delivery_state = ?, hold_reason_code = ?, updated_at = ? WHERE id = ?`,
          )
          .run(nextState, input.reasonCode, input.at, handoff.id);
        this.#appendEvent(
          handoff.conversationId,
          handoff.id,
          'recovered',
          input.actor,
          input.reasonCode,
          coordinationSafeSummary('delivery_changed', { state: 'manual_actionable' }),
          input.at,
        );
      }
      return handoffs.map((handoff) => this.findHandoffById(handoff.id)!);
    })();
  }
}

interface CoordinationCursor {
  timestamp: string;
  id: string;
}

function encodeCursor(timestamp: string, id: string): string {
  return Buffer.from(JSON.stringify({ timestamp, id }), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): CoordinationCursor {
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      typeof value !== 'object' ||
      value === null ||
      Object.keys(value).length !== 2 ||
      !('timestamp' in value) ||
      !('id' in value) ||
      typeof value.timestamp !== 'string' ||
      typeof value.id !== 'string'
    ) {
      throw new Error('invalid');
    }
    return { timestamp: value.timestamp, id: value.id };
  } catch {
    throw new ThreadHelmError('INVALID_REQUEST', 'Coordination cursor is invalid.');
  }
}
