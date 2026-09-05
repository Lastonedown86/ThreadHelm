/** Human sentences for coordinator reason codes. Codes never reach the screen. */
export const REASON_LABELS: Readonly<Record<string, string>> = {
  MAIN_STARTUP_FAILED: 'ThreadHelm could not finish starting.',
  MISSION_AUTHORITY_REQUIRED: 'This step needs your decision before work continues.',
  MISSION_BOUND_REACHED: 'A mission limit was reached, so work stopped here.',
  MISSION_COMPLETED: 'The mission completed with retained evidence.',
  MISSION_CONFIRMED: 'The mission was confirmed.',
  MISSION_CONTENT_DELETED: 'Mission content was deleted; receipts remain.',
  MISSION_DRAFT_LIMIT: 'Too many drafts are open; complete or delete one first.',
  MISSION_DRAFT_NOT_FOUND: 'This mission draft could not be found.',
  MISSION_DRAFT_STALE: 'The draft changed after it was displayed.',
  MISSION_DRAFT_SAVE_FAILED: 'Your draft could not be saved. Nothing has been discarded.',
  MISSION_DRAFT_DISCARD_STALE: 'The draft changed since the discard preview. Preview it again.',
  MISSION_CONFIRMATION_EXPIRED:
    'The review expired. Return to access and limits for a fresh approval.',
  MISSION_ENVELOPE_STALE: 'The mission envelope changed and needs a fresh review.',
  MISSION_NOT_FOUND: 'This mission could not be found.',
  MISSION_PINNED: 'The mission was pinned.',
  MISSION_POWER_BOUNDARY: 'Work paused at a power event and did not resume by itself.',
  PERMISSION_ALLOWLIST_UNAVAILABLE: 'The provider cannot use the requested permission allowlist.',
  PERMISSION_AUTO_UNAVAILABLE: 'Automatic permission mode is not available for this provider.',
  PERMISSION_CAPABILITY_CHANGED: 'Provider permission capabilities changed since review.',
  PERMISSION_MAPPING_MISMATCH:
    "The provider's permission mapping did not match the reviewed launch policy.",
  PERMISSION_POLICY_HELD: 'Permission policy held this action for your review.',
  REPO_IDEAS_UNAVAILABLE: "Couldn't generate ideas right now.",
  REPO_IDEAS_OUTPUT_INVALID: "Couldn't generate ideas right now.",
  STARTUP_DELIVERY_UNCERTAIN: 'A delivery outcome is uncertain after restart.',
  STARTUP_FAILED: 'ThreadHelm could not finish starting.',
  STARTUP_RECONCILIATION: 'ThreadHelm restarted and could not confirm this work.',
  SUPERVISOR_DECISION_LOOP: 'The supervisor repeated the same decision and was stopped.',
  SUPERVISOR_LOST: 'The supervisor session ended, so coordination stopped.',
  SUPERVISOR_NOT_BOUND: 'No supervisor is bound to this mission.',
  SUPERVISOR_OUTPUT_INVALID: 'The supervisor returned something ThreadHelm could not validate.',
  SUPERVISOR_PAUSED: 'The supervisor paused this work.',
  SUPERVISOR_RECOVERY_REQUIRED: 'The supervisor needs recovery before work can continue.',
  SUPERVISOR_ROLE_REQUIRED: 'Only the supervisor may make this change.',
  SUPERVISOR_ROLE_TOOLS: 'This tool is reserved for the supervisor role.',
  SUPERVISOR_TOOL_NAMES: 'The supervisor used a tool name ThreadHelm does not recognize.',
  WORKER_AUTOSTART_NOT_AUTHORIZED: 'Automatic worker start was not authorized.',
  WORKER_AUTOSTART_PREFLIGHT_FAILED: 'Worker start preflight failed, so nothing launched.',
  WORKER_AUTHORITY_REQUIRED: 'The worker needs your decision before continuing.',
  WORKER_SESSION_ENDED: 'The worker session ended before returning a result.',
  WORKER_START_DISPATCHED: 'The worker start was dispatched.',
  WORKER_START_FAILED_BEFORE_EFFECT: 'The worker failed to start and made no changes.',
  WORKER_START_OUTCOME_UNKNOWN: 'The worker start outcome is unknown.',
  WORKER_UNKNOWN: 'The outcome is unknown; retained evidence is kept as it is.',
};

export function reasonLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  const known = REASON_LABELS[code];
  if (known) return known;
  const words = code.toLowerCase().replaceAll('_', ' ');
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}.`;
}
