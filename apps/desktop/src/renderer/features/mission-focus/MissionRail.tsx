import { useRef, type KeyboardEvent } from 'react';
import type { MissionSummaryView } from '@threadhelm/contracts';
import { missionTitle } from './mission-presentation.js';

export interface MissionRailProps {
  missions: MissionSummaryView[];
  titles: Record<string, string>;
  selectedMissionId: string | null;
  onSelect(missionId: string): void;
  onCreate(): void;
}

function focusMissionHeading() {
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>('#mission-workspace h1')?.focus();
  });
}

export function MissionRail({
  missions,
  titles,
  selectedMissionId,
  onSelect,
  onCreate,
}: MissionRailProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const ids = missions.map((mission) => mission.id);

  const activate = (missionId: string) => {
    onSelect(missionId);
    focusMissionHeading();
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
    onSelect(ids[next]!);
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
            {mission.state.replaceAll('_', ' ')}
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
                  {mission.state.replaceAll('_', ' ')} · {mission.id.slice(0, 8)}
                </small>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
