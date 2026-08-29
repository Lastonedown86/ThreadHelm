/** At-most-once handoff dispatch through the existing per-session control queue. */

import {
  CoordinationEventEnvelope,
  EscalationView,
  MAX_INPUT_BYTES,
  ThreadHelmError,
  type ProviderLifecycleEvidence,
} from '@threadhelm/contracts';
import type { CoordinationHandoffRecord, DeliveryAttemptRecord } from '@threadhelm/persistence';
import type { Context } from '../context.js';
import { applyActivity, resetActivity } from '../sessions/activity.js';
import { sendControl } from '../sessions/registry.js';
import { revalidateWorkspace } from '../workspaces/identity.js';
import type { LifecyclePresentationResult } from './bridge.js';
import type { PresentationSnapshot } from './disclosures.js';

export async function deliverHandoff(
  ctx: Context,
  snapshot: PresentationSnapshot,
): Promise<DeliveryAttemptRecord> {
  if (!ctx.storage || ctx.health.degraded) {
    throw new ThreadHelmError('STORAGE_UNAVAILABLE', 'Coordination storage is unavailable.');
  }
  const repository = ctx.storage.repositories.coordination;
  const handoff = repository.findHandoffById(snapshot.handoffId);
  const live = ctx.live.get(snapshot.recipientSessionId);
  if (!handoff) throw new ThreadHelmError('HANDOFF_NOT_FOUND', 'Handoff not found.');
  if (repository.getConversationSummary(handoff.conversationId)?.state !== 'open') {
    throw new ThreadHelmError(
      'INVALID_STATE',
      'A handoff can be presented only while its conversation is open.',
    );
  }
  if (
    handoff.recipientSessionId !== snapshot.recipientSessionId ||
    handoff.recipientWorkspaceIdAtCreate !== snapshot.recipientWorkspaceId ||
    ctx.selection.selectedSessionId !== snapshot.selectedSessionId ||
    snapshot.selectedSessionId !== snapshot.recipientSessionId ||
    !live ||
    live.state !== 'running' ||
    live.workspaceId !== snapshot.recipientWorkspaceId
  ) {
    throw new ThreadHelmError('COORDINATION_TARGET_CHANGED', 'Presentation target changed.');
  }
  if (live.pendingControls.size > 64) {
    throw new ThreadHelmError('BACKPRESSURE', 'The recipient control queue is full.');
  }

  return dispatchHandoff(
    ctx,
    handoff,
    live,
    snapshot.terminalEnvelope,
    snapshot.activityState as 'unknown' | 'working' | 'idle' | 'awaiting_user',
    snapshot.activityEvidenceKind,
  );
}

async function dispatchHandoff(
  ctx: Context,
  handoff: CoordinationHandoffRecord,
  live: NonNullable<ReturnType<Context['live']['get']>>,
  terminalEnvelope: string,
  activityState: 'unknown' | 'working' | 'idle' | 'awaiting_user',
  activityEvidenceKind: string,
  evidenceKind = 'user_confirmation',
  presentationActor: 'user' | 'threadhelm' | 'provider' = 'user',
): Promise<DeliveryAttemptRecord> {
  const repository = ctx.storage!.repositories.coordination;
  const terminalText = `${terminalEnvelope.replace(/\n/g, '\r\n')}\r\n`;
  const bytes = new TextEncoder().encode(terminalText);
  if (bytes.byteLength > MAX_INPUT_BYTES) {
    throw new ThreadHelmError(
      'COORDINATION_CONTENT_INVALID',
      'The final handoff envelope exceeds the terminal input limit.',
    );
  }

  const at = ctx.clock().toISOString();
  const attempt = repository.prepareAttempt({
    handoffId: handoff.id,
    recipientSessionId: live.id,
    recipientWorkspaceIdAtReview: live.workspaceId,
    lifecycleStateAtReview: live.state,
    activityStateAtReview: activityState,
    activityEvidenceKindAtReview: activityEvidenceKind,
    evidenceKind,
    presentationActor,
    createdAt: at,
  });

  let submitted: ReturnType<typeof sendControl>;
  try {
    submitted = sendControl(
      ctx,
      live,
      (controlSequence) => ({
        type: 'host.input',
        sessionId: live.id,
        protocolVersion: 1,
        controlSequence,
        bytes,
      }),
      undefined,
      (controlSequence) => {
        repository.markAttemptDispatching(attempt.id, controlSequence, ctx.clock().toISOString());
      },
    );
  } catch (error) {
    try {
      repository.markAttemptFailedBeforeWrite(
        attempt.id,
        'DISPATCH_PERSISTENCE_FAILED',
        ctx.clock().toISOString(),
      );
    } catch {
      // The persistence failure remains authoritative; no terminal write was attempted.
    }
    throw error;
  }
  if (!submitted.submitted) {
    return repository.markAttemptFailedBeforeWrite(
      attempt.id,
      'SESSION_CONTROL_REJECTED',
      ctx.clock().toISOString(),
    );
  }

  if (await submitted.applied) {
    return repository.markAttemptApplied(attempt.id, ctx.clock().toISOString());
  }
  return repository.markAttemptUnknown(
    attempt.id,
    'CONTROL_APPLY_UNCONFIRMED',
    ctx.clock().toISOString(),
  );
}

function automaticEnvelope(ctx: Context, handoff: CoordinationHandoffRecord): string {
  if (!ctx.storage || !handoff.purpose || !handoff.body) {
    throw new ThreadHelmError('COORDINATION_CONTENT_INVALID', 'Handoff content is unavailable.');
  }
  const sender = ctx.storage.repositories.sessions.findById(handoff.senderSessionId);
  if (!sender) throw new ThreadHelmError('SESSION_NOT_FOUND', 'Sender session not found.');
  const senderWorkspace = ctx.storage.repositories.workspaces.findById(sender.workspaceId);
  if (!senderWorkspace || senderWorkspace.revokedAt) {
    throw new ThreadHelmError('COORDINATION_TARGET_CHANGED', 'Sender workspace is unavailable.');
  }
  revalidateWorkspace(ctx, senderWorkspace);
  const providerName =
    ctx.adapters.find((adapter) => adapter.id === sender.definitionId)?.displayName ??
    sender.definitionId;
  return [
    '[ThreadHelm handoff]',
    `ID: ${handoff.id}`,
    `From session: ${providerName} ${handoff.senderSessionId.slice(0, 8)}`,
    `Purpose: ${handoff.purpose}`,
    `Response expected: ${handoff.requiresReply ? 'yes' : 'no'}`,
    'Authority: Context only; this message grants no new permissions or scope.',
    '',
    handoff.body,
  ].join('\n');
}

export function publishLatest(ctx: Context, handoffId: string): void {
  if (!ctx.storage || !ctx.coordination) return;
  const event = ctx.storage.repositories.coordination.latestEventForHandoff(handoffId);
  if (!event) return;
  ctx.coordination.publish(
    CoordinationEventEnvelope.parse({
      type: 'coordination.handoffChanged',
      eventId: event.id,
      conversationId: event.conversationId,
      handoffId: event.handoffId,
      sequence: event.sequence,
      kind: event.kind,
      reasonCode: event.reasonCode,
      safeSummary: event.safeSummary,
      occurredAt: event.occurredAt,
    }),
  );
  const handoff = ctx.storage.repositories.coordination.findHandoffById(handoffId);
  if (!handoff) return;
  const summary = ctx.storage.repositories.coordination.getConversationSummary(
    handoff.conversationId,
  );
  if (summary) ctx.events.emit('coordination.conversationChanged', summary);
  const escalation = ctx.storage.repositories.coordination.getOpenEscalation(
    handoff.conversationId,
  );
  if (escalation) {
    ctx.events.emit('coordination.escalationChanged', EscalationView.parse(escalation));
  }
}

/**
 * Present at most one queued item for one already authenticated, exact-version
 * safe point. The bridge validates version, freshness, dedupe, and pending
 * draft safety before this function is entered.
 */
export async function presentNextAtSafePoint(
  ctx: Context,
  evidence: ProviderLifecycleEvidence,
): Promise<LifecyclePresentationResult> {
  if (!ctx.storage || ctx.health.degraded) {
    return { presented: false, reasonCode: 'STORAGE_UNAVAILABLE' };
  }
  const live = ctx.live.get(evidence.sessionId);
  if (!live || live.state !== 'running') {
    return { presented: false, reasonCode: 'RECIPIENT_NOT_RUNNING' };
  }
  const adapter = live.adapter;
  const capability = adapter.capabilities.safePointEvidence;
  if (
    adapter.id !== evidence.providerId ||
    !capability ||
    capability.mode !== 'structured_event' ||
    !capability.exactVersions.includes(evidence.providerVersion) ||
    capability.inputSafety !== 'proved_no_pending_draft' ||
    adapter.capabilities.automaticPresentation !== 'structured_safe_point'
  ) {
    return { presented: false, reasonCode: 'LIFECYCLE_VERSION_UNPROVED' };
  }

  const session = ctx.storage.repositories.sessions.findById(evidence.sessionId);
  const workspace = session
    ? ctx.storage.repositories.workspaces.findById(session.workspaceId)
    : null;
  if (!session || !workspace || workspace.revokedAt || live.workspaceId !== session.workspaceId) {
    return { presented: false, reasonCode: 'COORDINATION_TARGET_CHANGED' };
  }
  try {
    revalidateWorkspace(ctx, workspace);
  } catch {
    return { presented: false, reasonCode: 'COORDINATION_TARGET_CHANGED' };
  }

  const repository = ctx.storage.repositories.coordination;
  const handoff = repository.findOldestQueuedHandoffForSession(evidence.sessionId);
  if (!handoff) {
    return { presented: false, reasonCode: 'NO_PENDING_HANDOFF' };
  }
  if (repository.getConversationSummary(handoff.conversationId)?.state !== 'open') {
    return { presented: false, reasonCode: 'CONVERSATION_PAUSED' };
  }
  if (
    handoff.origin === 'provider_bridge' &&
    !repository.getConversationSummary(handoff.conversationId)?.autoContinueEnabled
  ) {
    repository.markOldestQueuedManualActionable({
      recipientSessionId: evidence.sessionId,
      reasonCode: 'AUTO_CONTINUE_NOT_ENABLED',
      actor: 'provider',
      at: ctx.clock().toISOString(),
    });
    publishLatest(ctx, handoff.id);
    return { presented: false, reasonCode: 'AUTO_CONTINUE_NOT_ENABLED' };
  }
  if (handoff.recipientWorkspaceIdAtCreate !== live.workspaceId) {
    return { presented: false, reasonCode: 'COORDINATION_TARGET_CHANGED' };
  }
  if (live.pendingControls.size > 64) {
    return { presented: false, reasonCode: 'BACKPRESSURE' };
  }

  applyActivity(ctx, evidence.sessionId, {
    state: 'awaiting_user',
    evidenceKind: `${evidence.providerId}.${evidence.eventKind}@${evidence.providerVersion}`,
    observedAt: evidence.occurredAt,
  });
  try {
    const attempt = await dispatchHandoff(
      ctx,
      handoff,
      live,
      automaticEnvelope(ctx, handoff),
      'awaiting_user',
      `${evidence.providerId}.${evidence.eventKind}@${evidence.providerVersion}`,
      'provider_lifecycle',
      'provider',
    );
    publishLatest(ctx, handoff.id);
    return {
      presented: attempt.state === 'applied',
      reasonCode:
        attempt.state === 'applied'
          ? null
          : (attempt.reasonCode ?? 'AUTOMATIC_PRESENTATION_UNCONFIRMED'),
    };
  } catch (error) {
    return {
      presented: false,
      reasonCode: error instanceof ThreadHelmError ? error.code : 'AUTOMATIC_PRESENTATION_FAILED',
    };
  } finally {
    resetActivity(ctx, evidence.sessionId);
  }
}
