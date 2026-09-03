import { useEffect } from 'react';
import type { MissionDetailView } from '@threadhelm/contracts';
import { useStore } from '../../store.js';
import { MissionTerminalDock } from '../session/MissionTerminalDock.js';
import { LIFECYCLE_LABEL } from './SessionList.js';
import { SessionList } from './SessionList.js';
import { WorkspacePanel } from '../workspaces/WorkspacePanel.js';
import { ProviderReadiness } from '../workspaces/ProviderReadiness.js';
import { CoordinationPanel } from '../coordination/CoordinationPanel.js';
import { ConversationView } from '../coordination/ConversationView.js';

export function SessionWorkspace({ mission }: { mission: MissionDetailView | null }) {
  const { state, actions } = useStore();
  const boundIds = new Set(
    mission?.envelope?.bindings.flatMap((binding) =>
      binding.sessionId ? [binding.sessionId] : [],
    ) ?? [],
  );
  const sessions = state.sessionOrder
    .map((id) => state.sessions[id]!)
    .filter((session) => !mission || boundIds.has(session.id));
  const selected = sessions.find((session) => session.id === state.selectedSessionId);
  // A mission dock with tabs but no selection rendered nothing; pick the first bound session.
  const firstBoundId = mission && !selected ? sessions[0]?.id : undefined;
  useEffect(() => {
    if (firstBoundId) actions.select(firstBoundId);
  }, [firstBoundId, actions]);
  return (
    <main className="session-workspace" aria-labelledby="session-workspace-heading">
      <header className="workspace-page-header">
        <p className="eyebrow">Mission terminal dock</p>
        <h1 id="session-workspace-heading">{mission?.envelope?.objective ?? 'Local sessions'}</h1>
        <p>
          {mission
            ? 'Only sessions bound to this selected mission appear here.'
            : 'Select a mission to narrow the dock to its exact workers.'}
        </p>
      </header>
      {!mission ? (
        <details className="session-start-controls" open>
          <summary>Start a local session</summary>
          <div className="session-start-grid">
            <WorkspacePanel />
            <ProviderReadiness />
          </div>
        </details>
      ) : null}
      {sessions.length === 0 ? (
        <section className="mission-workspace-state">
          <h2>No attached sessions</h2>
          <p>Start an approved session or bind a reviewed profile through a mission.</p>
        </section>
      ) : (
        <>
          {!mission ? <SessionList showHeading={false} /> : null}
          {!mission ? (
            <details className="session-start-controls" open>
              <summary>Directed handoffs and conversations</summary>
              <div className="session-coordination-grid">
                <CoordinationPanel />
                <ConversationView />
              </div>
            </details>
          ) : null}
          <div className="session-tabs" role="tablist" aria-label="Mission sessions">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                role="tab"
                aria-selected={session.id === selected?.id}
                className={session.id === selected?.id ? 'selected' : undefined}
                onClick={() => actions.select(session.id)}
              >
                {session.providerDisplayName}{' '}
                <span className="small-text">{LIFECYCLE_LABEL[session.lifecycleState]}</span>
                {state.unread[session.id] ? (
                  <span className="badge attention">new output</span>
                ) : null}
              </button>
            ))}
          </div>
          {selected ? <MissionTerminalDock session={selected} sessions={sessions} /> : null}
        </>
      )}
    </main>
  );
}
