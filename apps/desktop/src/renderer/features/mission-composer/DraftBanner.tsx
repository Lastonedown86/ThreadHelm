import { reasonLabel } from '../mission-focus/reason-labels.js';
import type { DraftFailure } from './useDraft.js';

export function DraftBanner({
  failure,
  storageDegraded,
  onRetry,
  onKeepEditing,
  onDiscard,
  onUseSaved,
  onKeepMine,
}: {
  failure: DraftFailure | null;
  storageDegraded: boolean;
  onRetry(): void;
  onKeepEditing(): void;
  onDiscard(): void;
  onUseSaved(): void;
  onKeepMine(): void;
}) {
  if (!failure && !storageDegraded) return null;
  if (failure?.savedElsewhere)
    return (
      <div className="banner composer-banner" role="alert">
        <p>{reasonLabel('MISSION_DRAFT_STALE')}</p>
        <div className="actions">
          <button type="button" onClick={onUseSaved}>
            Use saved version
          </button>
          <button type="button" onClick={onKeepMine}>
            Keep my edits
          </button>
        </div>
      </div>
    );
  return (
    <div className="banner error composer-banner" role="alert">
      <p>
        {storageDegraded
          ? 'Local storage is degraded. Your draft cannot be saved right now, and nothing has been discarded.'
          : reasonLabel(failure?.code ?? 'MISSION_DRAFT_SAVE_FAILED')}
      </p>
      <div className="actions">
        <button type="button" onClick={onRetry} disabled={storageDegraded}>
          Retry
        </button>
        <button type="button" onClick={onKeepEditing}>
          Keep editing
        </button>
        <button type="button" className="danger" onClick={onDiscard}>
          Discard draft…
        </button>
      </div>
    </div>
  );
}
