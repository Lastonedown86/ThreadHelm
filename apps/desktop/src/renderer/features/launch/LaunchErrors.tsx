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
