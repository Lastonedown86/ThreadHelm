import { errorCode } from '../../api.js';
import { LaunchError } from '../launch/LaunchErrors.js';

const MESSAGES: Readonly<Record<string, string>> = {
  CONFIRMATION_REQUIRED: 'Review this profile or export target and confirm the requested action.',
  CONFIRMATION_EXPIRED:
    'This review expired or was used. Refresh the manifest review and confirm again.',
  TARGET_CHANGED:
    'The export file or folder changed after review. Choose the target again and review it before exporting.',
  INVALID_STATE:
    'This draft or template cannot be changed now. Close and reload it; delete any dependent drafts before deleting their template.',
  PROFILE_REVISION_STALE:
    'The source template or profile changed. Your saved draft is preserved; start a new draft from the current source.',
  PROFILE_DIGEST_CHANGED:
    'The draft changed after review. Refresh the manifest review and confirm again.',
  PROFILE_LIMIT_REACHED:
    'A local profile, template, revision, or draft limit was reached. Remove unused items before creating more.',
};

export function AgentAuthoringError({ error }: { error: unknown }) {
  if (!error) return null;
  const message = MESSAGES[errorCode(error) ?? ''];
  return message ? (
    <p className="notice error" role="alert">
      {message}
    </p>
  ) : (
    <LaunchError error={error} />
  );
}
