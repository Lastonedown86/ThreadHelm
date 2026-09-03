import { useEffect, useState } from 'react';
import type { MissionComposerDraftSummaryView } from '@threadhelm/contracts';
import { api, call } from '../../api.js';
import { useStore } from '../../store.js';
import { STAGE_LABEL } from './composer-fields.js';

function relative(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

export function DraftList({ onResume }: { onResume(draftId: string): void }) {
  const { state } = useStore();
  const [drafts, setDrafts] = useState<MissionComposerDraftSummaryView[]>([]);
  useEffect(() => {
    let cancelled = false;
    void call(api.missionComposer.listDrafts(undefined))
      .then((page) => !cancelled && setDrafts(page.drafts))
      .catch(() => !cancelled && setDrafts([]));
    return () => {
      cancelled = true;
    };
  }, [state.missionSequence]);
  if (!drafts.length) return null;
  return (
    <section className="composer-drafts" aria-labelledby="composer-drafts-heading">
      <h2 id="composer-drafts-heading">Drafts</h2>
      <ul className="list">
        {drafts.map((draft) => (
          <li key={draft.draftId}>
            <button type="button" className="small" onClick={() => onResume(draft.draftId)}>
              Resume draft · {STAGE_LABEL[draft.currentStage]} · {relative(draft.updatedAt)}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
