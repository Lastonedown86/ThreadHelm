import type { SessionView } from '@threadhelm/contracts';
import { useRef } from 'react';
import { useStore } from '../../store.js';
import { ControlBar } from '../control/ControlBar.js';
import { LazyTerminalPane } from './LazyTerminal.js';
import { LIFECYCLE_LABEL, ACTIVITY_LABEL } from '../sessions/SessionList.js';

export function MissionTerminalDock({
  session,
  sessions,
}: {
  session: SessionView;
  sessions: SessionView[];
}) {
  const { state } = useStore();
  const mountedSessionIds = useRef(new Set<string>());
  mountedSessionIds.current.add(session.id);
  const needsInspector =
    session.lifecycleState === 'failed' || session.lifecycleState === 'recovery_required';
  return (
    <section className="mission-terminal-dock" aria-labelledby="terminal-dock-heading">
      <header>
        <div>
          <p className="eyebrow">Exact session</p>
          <h2 id="terminal-dock-heading">
            {session.providerDisplayName} ·{' '}
            <span className="mono">{session.workspaceDisplayPath}</span>
          </h2>
        </div>
        <span className={`badge ${session.lifecycleState}`}>
          {LIFECYCLE_LABEL[session.lifecycleState]}
        </span>
      </header>
      <ControlBar key={session.id} session={session} />
      {needsInspector ? (
        <details className="session-lifecycle-inspector" open>
          <summary>Lifecycle evidence</summary>
          <dl className="setup-evidence">
            <dt>Session</dt>
            <dd className="mono">{session.id}</dd>
            <dt>Lifecycle</dt>
            <dd>{LIFECYCLE_LABEL[session.lifecycleState]}</dd>
            <dt>Activity</dt>
            <dd>{ACTIVITY_LABEL[session.activityState]}</dd>
            <dt>Exit</dt>
            <dd>{session.exitCode ?? 'No known exit code'}</dd>
            <dt>Recovery</dt>
            <dd>Automatic replay is unavailable for unknown work.</dd>
          </dl>
        </details>
      ) : null}
      {(state.truncation[session.id] ?? session.truncationCount) > 0 ? (
        <p className="notice warning" role="status">
          Earlier output was truncated to preserve the bounded renderer buffer.
        </p>
      ) : null}
      <div className="mission-terminal-stack">
        {sessions
          .filter((candidate) => mountedSessionIds.current.has(candidate.id))
          .map((candidate) => (
            <div
              key={candidate.id}
              className={candidate.id === session.id ? 'active-terminal' : 'inactive-terminal'}
              aria-hidden={candidate.id !== session.id}
            >
              <LazyTerminalPane
                session={candidate}
                active={candidate.id === session.id}
                truncationCount={state.truncation[candidate.id] ?? candidate.truncationCount}
                streamFailure={state.streamFailed[candidate.id] ?? null}
                inputNotice={state.inputNotice[candidate.id] ?? null}
              />
            </div>
          ))}
      </div>
    </section>
  );
}
