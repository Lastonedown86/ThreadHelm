/** At-most-once handoff dispatch through the existing per-session control queue. */

import { MAX_INPUT_BYTES, ThreadHelmError } from '@threadhelm/contracts';
import type { DeliveryAttemptRecord } from '@threadhelm/persistence';
import type { Context } from '../context.js';
import { sendControl } from '../sessions/registry.js';
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

  const terminalText = `${snapshot.terminalEnvelope.replace(/\n/g, '\r\n')}\r\n`;
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
    activityStateAtReview: snapshot.activityState as
      'unknown' | 'working' | 'idle' | 'awaiting_user',
    activityEvidenceKindAtReview: snapshot.activityEvidenceKind,
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
