import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { MissionComposerDraftSummaryView, MissionSummaryView } from '@threadhelm/contracts';
import { relativeTime, STAGE_LABEL } from '../mission-composer/composer-fields.js';
import { missionTitle } from './mission-presentation.js';

export interface MissionRailProps {
  missions: MissionSummaryView[];
  titles: Record<string, string>;
  statuses: Record<string, string>;
  selectedMissionId: string | null;
  onSelect(missionId: string): void | Promise<boolean>;
  onCreate(): void;
  drafts: MissionComposerDraftSummaryView[];
  draftLoadError: boolean;
  onRetryDrafts(): void;
  onResumeDraft(draftId: string): void;
  selectedDraftId: string | null;
  onDiscardDraft(draftId: string): void;
}

function focusMissionHeading() {
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>('#mission-workspace h1')?.focus();
  });
}

export function MissionRail({
  missions,
  titles,
  statuses,
  selectedMissionId,
  onSelect,
  onCreate,
  drafts,
  draftLoadError,
  onRetryDrafts,
  onResumeDraft,
  selectedDraftId,
  onDiscardDraft,
}: MissionRailProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const ids = missions.map((mission) => mission.id);
  useEffect(() => {
    if (document.activeElement === listRef.current) {
      listRef.current
        ?.querySelector('[aria-selected="true"]')
        ?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedMissionId]);

  const activate = (missionId: string) => {
    void Promise.resolve(onSelect(missionId)).then((accepted) => {
      if (accepted !== false) focusMissionHeading();
    });
  };

  const move = (event: KeyboardEvent<HTMLUListElement>) => {
    if (ids.length === 0) return;
    const index = selectedMissionId ? ids.indexOf(selectedMissionId) : -1;
    let next: number;
    switch (event.key) {
      case 'ArrowDown':
        next = Math.min(index + 1, ids.length - 1);
        break;
      case 'ArrowUp':
        next = Math.max(index - 1, 0);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = ids.length - 1;
        break;
      case 'Enter':
      case ' ':
        if (index >= 0) activate(ids[index]!);
        event.preventDefault();
        return;
      default:
        return;
    }
    event.preventDefault();
    void onSelect(ids[next]!);
  };

  return (
    <section className="mission-rail" aria-labelledby="mission-rail-heading">
      <header>
        <div>
          <span className="threadhelm-mark" aria-hidden="true">
            T
          </span>
          <h2 id="mission-rail-heading">ThreadHelm</h2>
        </div>
        <button type="button" className="mission-create-button" onClick={onCreate}>
          New mission…
        </button>
      </header>
      <label className="mission-picker-label" htmlFor="mission-picker">
        Selected mission
      </label>
      <select
        id="mission-picker"
        className="mission-picker"
        value={selectedMissionId ?? ''}
        onChange={(event) => activate(event.currentTarget.value)}
      >
        <option value="" disabled>
          Choose a mission
        </option>
        {missions.map((mission) => (
          <option key={mission.id} value={mission.id}>
            {titles[mission.id] ?? missionTitle(null, mission.id)} ·{' '}
            {statuses[mission.id] ?? `${mission.state.replaceAll('_', ' ')} · Loading details…`}
          </option>
        ))}
      </select>
      {missions.length === 0 ? <p className="mission-rail-empty">No missions yet.</p> : null}
      <ul
        ref={listRef}
        className="mission-rail-list"
        role="listbox"
        aria-label="Missions"
        aria-activedescendant={selectedMissionId ? `mission-rail-${selectedMissionId}` : undefined}
        tabIndex={missions.length > 0 ? 0 : -1}
        onKeyDown={move}
      >
        {missions.map((mission) => {
          const selected = mission.id === selectedMissionId;
          return (
            <li
              key={mission.id}
              id={`mission-rail-${mission.id}`}
              role="option"
              aria-selected={selected}
              className={selected ? 'selected' : undefined}
              onClick={() => activate(mission.id)}
            >
              <span className="mission-state-shape" data-state={mission.state} aria-hidden="true" />
              <span>
                <strong>{titles[mission.id] ?? missionTitle(null, mission.id)}</strong>
                <small>
                  {mission.workItemCount > 0
                    ? `${mission.completedWorkItemCount}/${mission.workItemCount} · `
                    : ''}
                  {statuses[mission.id] ??
                    `${mission.state.replaceAll('_', ' ')} · Loading details…`}{' '}
                  · {mission.id.slice(0, 8)}
                </small>
              </span>
            </li>
          );
        })}
      </ul>
      {draftLoadError ? (
        <div role="alert">
          <p>Drafts could not be refreshed. Any rows shown are from the last successful read.</p>
          <button type="button" onClick={onRetryDrafts}>
            Retry drafts
          </button>
        </div>
      ) : null}
      {drafts.length ? (
        <details className="mission-rail-drafts" open>
          <summary>Drafts ({drafts.length})</summary>
          {drafts.length >= 20 ? (
            <p role="status">
              All 20 draft slots are in use. Resume a draft to finish it, or discard one below
              before creating another.
            </p>
          ) : null}
          <ul className="list">
            {drafts.map((draft) => (
              <li key={draft.draftId} id={`mission-draft-${draft.draftId}`}>
                <button
                  type="button"
                  className="small"
                  title={draft.title || 'Untitled mission draft'}
                  aria-current={selectedDraftId === draft.draftId ? 'true' : undefined}
                  aria-label={`Resume draft · ${STAGE_LABEL[draft.currentStage]} · ${draft.title || 'Untitled mission draft'} · ${draft.draftId}`}
                  onClick={() => onResumeDraft(draft.draftId)}
                >
                  <strong>{draft.title || 'Untitled mission draft'}</strong>
                  <small>
                    {STAGE_LABEL[draft.currentStage]} · {relativeTime(draft.updatedAt)} ·{' '}
                    {draft.draftId.slice(0, 8)}
                  </small>
                </button>
                <button
                  type="button"
                  className="small"
                  aria-label={`Discard draft · ${draft.title || 'Untitled mission draft'} · ${draft.draftId}`}
                  onClick={() => onDiscardDraft(draft.draftId)}
                >
                  Discard…
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
