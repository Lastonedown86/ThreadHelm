/**
 * Blocked-launch and control errors as actionable sentences (T049).
 * Every contract error code has an entry; the test enforces it.
 */

import { ErrorCode } from '@threadhelm/contracts';
import { RendererError } from '../../errors.js';

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  SELECTION_CANCELLED: 'No folder was chosen.',
  WORKSPACE_UNSUPPORTED:
    'That folder is on an unsupported volume (network, removable, or device path). Choose a folder on a fixed local drive.',
  WORKSPACE_AMBIGUOUS:
    'The folder’s effective location could not be established unambiguously. Choose the real folder rather than a junction or link.',
  WORKSPACE_NOT_FOUND:
    'That workspace approval no longer exists. Choose and approve the folder again.',
  WORKSPACE_CHANGED: 'The folder’s identity changed since approval. Review and re-approve it.',
  WORKSPACE_ACTIVE:
    'A session is still active in this folder. Stop it before revoking the approval.',
  CANDIDATE_EXPIRED: 'The folder selection expired. Choose the folder again.',
  PROBE_FAILED:
    'ThreadHelm could not check the agent tool. Retry, or verify the tool installation.',
  PROVIDER_UNAVAILABLE:
    'That agent tool is not ready. Check that it is installed, a tested version, and signed in.',
  WRITE_LEASE_HELD:
    'Another write-capable session is already active in this folder. Choose a separate folder or worktree.',
  PREVIEW_EXPIRED: 'The launch preview expired. Open the disclosure again.',
  CONFIRMATION_REQUIRED: 'Confirm the access boundary disclosure to launch this session.',
  SUPERVISION_FAILED:
    'ThreadHelm could not place the session under supervision, so nothing was started. Retry; if it persists, check Windows Job Object restrictions.',
  SESSION_NOT_FOUND: 'That session no longer exists.',
  INVALID_STATE: 'That action is not available in the session’s current state.',
  CONFIRMATION_EXPIRED: 'The confirmation expired. Request the action again.',
  TARGET_CHANGED:
    'The target session changed since the confirmation was shown. Request the action again.',
  FORCE_NOT_AVAILABLE: 'Force stop is only offered after a clean stop has been attempted.',
  NOT_SELECTED: 'Input goes only to the selected session. Select the session first.',
  INPUT_BLOCKED: 'This session is no longer accepting input.',
  BACKPRESSURE: 'The session is catching up on output. Try again in a moment.',
  INVALID_DIMENSIONS: 'The terminal size is out of range.',
  STREAM_VIOLATION: 'The output stream broke its ordering contract and was closed.',
  INVALID_RESOLUTION: 'That recovery record was already resolved.',
  RECORD_NOT_FOUND: 'That recovery record no longer exists.',
  STORAGE_UNAVAILABLE: 'ThreadHelm’s local storage is unavailable. Restart the application.',
  STORAGE_DEGRADED:
    'Local storage is in a degraded state; new launches and durable changes are blocked until it recovers.',
  CONVERSATION_NOT_FOUND: 'That coordination conversation no longer exists.',
  HANDOFF_NOT_FOUND: 'That handoff no longer exists.',
  ESCALATION_NOT_FOUND: 'That coordination escalation no longer exists.',
  COORDINATION_CONTENT_INVALID:
    'The handoff content did not meet the coordination safety and size rules.',
  COORDINATION_LIMIT_REACHED:
    'The coordination limit was reached. Resolve or remove inactive work before continuing.',
  COORDINATION_CAUSALITY_INVALID:
    'That reply does not belong to the reviewed coordination conversation.',
  COORDINATION_TARGET_CHANGED:
    'The coordination target changed since review. Review the handoff again.',
  COORDINATION_TARGET_NOT_SELECTED:
    'Select the reviewed recipient session before presenting this handoff.',
  COORDINATION_NOT_ELIGIBLE:
    'The selected session is not currently eligible for this coordination action.',
  COORDINATION_ATTEMPT_ACTIVE: 'A delivery attempt is already active for this handoff.',
  COORDINATION_DELIVERY_UNKNOWN:
    'ThreadHelm cannot prove whether this handoff was delivered. It will not retry automatically.',
  COORDINATION_BRIDGE_UNAVAILABLE:
    'Structured coordination is unavailable for this session; use the reviewed manual path.',
  COORDINATION_AUTHORITY_REQUIRED:
    'This action requires explicit user authority before coordination can continue.',
  COORDINATION_CLOSED: 'That coordination conversation is closed.',
  MEMORY_NOT_FOUND: 'That shared-memory entry or revision no longer exists.',
  MEMORY_SCOPE_UNAUTHORIZED:
    'That shared memory is outside the approved workspace or mission scope.',
  MEMORY_CONTENT_INVALID: 'The shared-memory content was rejected by the size or privacy boundary.',
  MEMORY_SOURCE_INVALID: 'One or more shared-memory sources are invalid or unattributed.',
  MEMORY_QUOTA_REACHED: 'This workspace or mission reached its active shared-memory quota.',
  MEMORY_CONFLICT_OPEN: 'That memory conflict still requires an explicit cited resolution.',
  MEMORY_REVISION_STALE: 'The shared-memory revision changed. Reload it before continuing.',
  MEMORY_CONTENT_DELETED: 'That shared-memory content was permanently deleted.',
  PROFILE_SCHEMA_INVALID: 'That agent profile manifest does not match the supported schema.',
  PROFILE_OVERSIZED: 'That agent profile manifest exceeds the supported size limits.',
  PROFILE_UNREADABLE: 'The selected agent profile file could not be read.',
  PROFILE_TOKEN_EXPIRED: 'The agent profile review expired. Preview it again.',
  PROFILE_DIGEST_CHANGED: 'The agent profile file changed after review. Preview it again.',
  PROFILE_LIMIT_REACHED: 'The local agent profile limit has been reached.',
  PROFILE_NOT_FOUND: 'That agent profile no longer exists.',
  PROFILE_INCOMPATIBLE: 'That agent profile is not compatible with the current provider runtime.',
  PROFILE_REVISION_STALE: 'That agent profile changed after review. Reload it before continuing.',
  PROFILE_MISSION_PINNED:
    'That agent profile is pinned by an active mission and cannot be removed.',
  MISSION_NOT_FOUND: 'That mission is no longer available. Refresh the mission list.',
  MISSION_ENVELOPE_STALE:
    'The mission or its launch settings changed. Review the exact envelope again.',
  MISSION_BOUND_REACHED:
    'A mission limit was reached. Review its bounds and held work before continuing.',
  SUPERVISOR_NOT_BOUND: 'Select a live, eligible supervisor session before resuming this mission.',
  SUPERVISOR_ROLE_REQUIRED:
    'Only the supervisor session bound to this mission can make that decision.',
  WORK_ITEM_NOT_FOUND: 'That work item is no longer available in this mission.',
  WORK_DAG_INVALID: 'The work dependencies are invalid or cyclic. Review the work plan.',
  WORK_LEASE_CONFLICT:
    'This work conflicts with an existing workspace lease. Resolve the lease or use another approved workspace.',
  WORK_ATTEMPT_UNKNOWN:
    'The previous attempt has an unknown outcome. Inspect its effects before taking an explicit recovery action; it will not be replayed automatically.',
  WORKER_AUTOSTART_NOT_AUTHORIZED:
    'Automatic startup was not authorized for this exact worker. Review a new mission envelope to change its binding.',
  WORKER_AUTOSTART_PREFLIGHT_FAILED:
    'The exact worker launch is unavailable or changed. The assignment is held without substitution or bypass.',
  SUPERVISOR_DECISION_LOOP:
    'Repeated equivalent decisions paused this mission. Review the work before resuming.',
  MISSION_AUTHORITY_REQUIRED:
    'This action exceeds the confirmed mission authority. Use the separate control for that exact action; supervisor text cannot approve it.',
  TEMPLATE_VARIABLE_UNRESOLVED:
    'Resolve every declared template variable before reviewing the generated agent.',
  TEMPLATE_DRAFT_INCOMPLETE:
    'Complete every required wizard value before saving or exporting the generated agent.',
  ACTIVE_SESSIONS: 'Sessions are still active. Cancel closing or stop all sessions first.',
  INVALID_REQUEST: 'The request was rejected as invalid.',
  UNAUTHORIZED_SENDER: 'The request came from an unauthorized source.',
  INTERNAL: 'An internal error occurred. Check the application log.',
};

export function describeError(error: unknown): string {
  if (error instanceof RendererError) return ERROR_MESSAGES[error.code];
  return ERROR_MESSAGES.INTERNAL;
}

export function LaunchError({ error }: { error: unknown | null }) {
  if (!error) return null;
  const code = error instanceof RendererError ? error.code : ('INTERNAL' satisfies ErrorCode);
  return (
    <p className="notice error" role="alert">
      <strong>{code}</strong> — {describeError(error)}
    </p>
  );
}

export const allErrorCodes = ErrorCode.options;
