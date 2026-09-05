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
  const missionScoped = state.sessionScope === 'mission' && !!state.selectedMissionId;
  const currentMission = mission?.id === state.selectedMissionId ? mission : null;
  const boundIds = new Set(
    currentMission?.envelope?.bindings.flatMap((binding) =>
      binding.sessionId ? [binding.sessionId] : [],
    ) ?? [],
  );
  const sessions = state.sessionOrder
    .map((id) => state.sessions[id]!)
    .filter((session) => !missionScoped || boundIds.has(session.id));
  const selected = sessions.find((session) => session.id === state.selectedSessionId);
  // Resolve selection only from the visible scope; stale mission details supply no candidates.
  const firstVisibleId = !selected ? sessions[0]?.id : undefined;
  useEffect(() => {
    if (firstVisibleId) actions.select(firstVisibleId);
  }, [firstVisibleId, actions]);
  return (
    <main className="session-workspace" aria-labelledby="session-workspace-heading">
      <header className="workspace-page-header">
        <p className="eyebrow">Sessions</p>
        <h1 id="session-workspace-heading">
          {missionScoped
            ? (currentMission?.envelope?.objective ?? 'Selected mission')
            : 'Local sessions'}
        </h1>
        <p>
          {missionScoped
            ? 'Only sessions bound to this selected mission appear here.'
            : 'All local sessions are shown. Use Session scope to narrow the dock to the selected mission.'}
        </p>
        <label className="field">
          Session scope
          <select
            value={missionScoped ? 'mission' : 'all'}
            onChange={(event) =>
              actions.setSessionScope(event.target.value === 'mission' ? 'mission' : 'all')
            }
          >
            <option value="all">All sessions</option>
            <option value="mission" disabled={!state.selectedMissionId}>
              Selected mission
            </option>
          </select>
        </label>
        <p className="small-text">{sessions.length} sessions in this scope</p>
      </header>
      {!missionScoped ? (
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
          <h2>
            {missionScoped && !currentMission
              ? 'Loading selected mission...'
              : 'No attached sessions'}
          </h2>
          <p>Start an approved session or bind a reviewed profile through a mission.</p>
        </section>
      ) : (
        <>
          {!missionScoped ? <SessionList showHeading={false} /> : null}
          {!missionScoped ? (
            <details className="session-start-controls" open>
              <summary>Directed handoffs and conversations</summary>
              <div className="session-coordination-grid">
                <CoordinationPanel />
                <ConversationView />
              </div>
            </details>
          ) : null}
          <div
            className="session-tabs"
            role="tablist"
            aria-label={missionScoped ? 'Mission sessions' : 'All sessions'}
          >
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
