/**
 * Session list (T061): identity, lifecycle state, honest activity, and
 * new-output attention. Keyboard: arrows / Home / End move, Enter or Space
 * selects; the listbox has a single tab stop.
 *
 * Ended sessions (stopped, failed, recovery required) accumulate and never
 * leave on their own, so they are collapsed behind one disclosure and only
 * join the listbox — and its keyboard order — while it is open.
 */

import { useRef, useState, type KeyboardEvent } from 'react';
import type { ActivityState, LifecycleState } from '@threadhelm/contracts';
import { useStore } from '../../store.js';

export const LIFECYCLE_LABEL: Record<LifecycleState, string> = {
  starting: 'Starting',
  running: 'Running',
  interrupting: 'Interrupting',
  stopping: 'Stopping',
  stopped: 'Stopped',
  failed: 'Failed',
  recovery_required: 'Recovery required',
};

export const ACTIVITY_LABEL: Record<ActivityState, string> = {
  unknown: 'Unknown',
  working: 'Working',
  idle: 'Idle',
  awaiting_user: 'Awaiting user',
};

const ENDED: ReadonlySet<LifecycleState> = new Set<LifecycleState>([
  'stopped',
  'failed',
  'recovery_required',
]);

export function SessionList({ showHeading = true }: { showHeading?: boolean } = {}) {
  const { state, actions } = useStore();
  const listRef = useRef<HTMLUListElement>(null);
  const [expandEnded, setExpandEnded] = useState(false);
  const selected = state.selectedSessionId;

  const live: string[] = [];
  const ended: string[] = [];
  for (const id of state.sessionOrder) {
    (ENDED.has(state.sessions[id]!.lifecycleState) ? ended : live).push(id);
  }
  // A selected ended session stays listed whatever the disclosure says: hiding
  // it would leave aria-activedescendant pointing at an element that is gone.
  const endedShown = expandEnded || (selected !== null && ended.includes(selected));
  const ids = endedShown ? [...live, ...ended] : live;

  const move = (event: KeyboardEvent<HTMLUListElement>) => {
    if (ids.length === 0) return;
    const index = selected ? ids.indexOf(selected) : -1;
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
        if (index >= 0) actions.select(ids[index]!);
        event.preventDefault();
        return;
      default:
        return;
    }
    event.preventDefault();
    actions.select(ids[next]!);
  };

  return (
    <section
      className="panel"
      {...(showHeading ? { 'aria-labelledby': 'sessions-heading' } : { 'aria-label': 'Sessions' })}
    >
      {showHeading ? <h2 id="sessions-heading">Sessions</h2> : null}
      {state.sessionOrder.length === 0 ? <p className="hint">No sessions yet.</p> : null}
      {state.sessionOrder.length > 0 && live.length === 0 && !endedShown ? (
        <p className="hint">No running sessions.</p>
      ) : null}
      <ul
        ref={listRef}
        role="listbox"
        aria-label="Sessions"
        aria-activedescendant={selected ? `session-${selected}` : undefined}
        tabIndex={0}
        className="list sessions"
        onKeyDown={move}
      >
        {ids.map((id) => {
          const session = state.sessions[id]!;
          const isSelected = id === selected;
          const unread = state.unread[id] === true;
          return (
            <li
              key={id}
              id={`session-${id}`}
              role="option"
              aria-selected={isSelected}
              className={isSelected ? 'selected' : undefined}
              onClick={() => actions.select(id)}
            >
              <div>
                <strong>{session.providerDisplayName}</strong>
                {unread ? <span className="badge attention"> new output</span> : null}
              </div>
              <div className="mono small-text">{session.workspaceDisplayPath}</div>
              <div className="hint">
                {LIFECYCLE_LABEL[session.lifecycleState]} · activity{' '}
                {ACTIVITY_LABEL[session.activityState]}
                {session.forceStopAvailable ? ' · force stop available' : ''}
              </div>
              <div className="hint">
                {session.startedAt
                  ? `started ${new Date(session.startedAt).toLocaleTimeString()}`
                  : `created ${new Date(session.createdAt).toLocaleTimeString()}`}
                {session.endedAt
                  ? ` · ended ${new Date(session.endedAt).toLocaleTimeString()}`
                  : ''}
                {session.exitCode !== null ? ` · exit ${session.exitCode}` : ''}
              </div>
            </li>
          );
        })}
      </ul>
      {ended.length > 0 ? (
        <button
          type="button"
          className="small ended-sessions-toggle"
          aria-expanded={endedShown}
          onClick={() => setExpandEnded((open) => !open)}
        >
          {endedShown ? 'Hide' : 'Show'} {ended.length} ended session
          {ended.length === 1 ? '' : 's'}
        </button>
      ) : null}
    </section>
  );
}
