import { api, call } from './api.js';
import { CloseBlockedDialog } from './features/control/CloseBlockedDialog.js';
import { ControlBar } from './features/control/ControlBar.js';
import { AgentProfileList } from './features/coordination/AgentProfileList.js';
import { CoordinationPanel } from './features/coordination/CoordinationPanel.js';
import { ConversationView } from './features/coordination/ConversationView.js';
import { MemoryList } from './features/coordination/MemoryList.js';
import { LaunchDialog } from './features/launch/LaunchDialog.js';
import { RecoveryPanel } from './features/recovery/RecoveryPanel.js';
import { TerminalPane } from './features/session/Terminal.js';
import { getTerminal } from './features/session/terminals.js';
import { SessionList } from './features/sessions/SessionList.js';
import { ProviderReadiness } from './features/workspaces/ProviderReadiness.js';
import { WorkspacePanel } from './features/workspaces/WorkspacePanel.js';
import { StoreProvider, useStore } from './store.js';

function currentTerminalSize(sessionId: string | null): { columns: number; rows: number } {
  const entry = sessionId ? getTerminal(sessionId) : undefined;
  if (entry?.opened) return { columns: entry.term.cols, rows: entry.term.rows };
  return { columns: 120, rows: 30 };
}

function Shell() {
  const { state, actions } = useStore();
  const selected = state.selectedSessionId ? state.sessions[state.selectedSessionId] : undefined;

  return (
    <div className="app">
      <a className="skip-link" href="#terminal">
        Skip to terminal
      </a>
      {state.storageDegraded ? (
        <p className="banner error" role="alert">
          Local storage is degraded. Live sessions stay visible and controllable, but new launches
          and durable changes are blocked until storage recovers.
        </p>
      ) : null}
      {state.powerNotice ? (
        <p className="banner" aria-live="polite">
          {state.powerNotice}
        </p>
      ) : null}
      {state.notice ? (
        <p className="banner" role="status">
          {state.notice}{' '}
          <button type="button" className="small" onClick={() => actions.setNotice(null)}>
            Dismiss
          </button>
        </p>
      ) : null}
      <div className="columns">
        <aside className="sidebar" aria-label="Workspaces, agents, and sessions">
          <RecoveryPanel />
          <WorkspacePanel />
          <ProviderReadiness />
          <SessionList />
          <MemoryList />
          <AgentProfileList />
          <CoordinationPanel />
          <ConversationView />
        </aside>
        <section className="workspace-main" aria-label="Selected session">
          {selected ? (
            <>
              <header className="session-header">
                <h1>
                  {selected.providerDisplayName}{' '}
                  <span className="mono small-text">{selected.workspaceDisplayPath}</span>
                </h1>
                <ControlBar session={selected} />
              </header>
              <TerminalPane
                session={selected}
                truncationCount={state.truncation[selected.id] ?? selected.truncationCount}
                streamFailure={state.streamFailed[selected.id] ?? null}
                inputNotice={state.inputNotice[selected.id] ?? null}
              />
            </>
          ) : (
            <div className="empty" id="terminal" tabIndex={-1}>
              <h1>ThreadHelm</h1>
              <p>Approve a folder, pick an available agent, and launch a session.</p>
            </div>
          )}
        </section>
      </div>
      <footer className="status-bar">
        {state.appInfo
          ? `ThreadHelm v${state.appInfo.version} · Electron ${state.appInfo.electronVersion} · ${state.appInfo.arch}`
          : 'ThreadHelm'}
      </footer>
      {state.launchRequest ? (
        <LaunchDialog
          request={state.launchRequest}
          terminal={currentTerminalSize(state.selectedSessionId)}
          onCancel={() => actions.openLaunch(null)}
          onLaunched={(session) => {
            const recordId = state.launchRequest?.recoveryRecordId;
            actions.openLaunch(null);
            actions.sessionAdded(session);
            actions.select(session.id);
            if (recordId) {
              void call(api.recovery.resolve({ recordId, resolution: 'superseded_by_new_session' }))
                .then((record) => actions.recoveryChanged(record))
                .catch(() => undefined);
            }
          }}
        />
      ) : null}
      {state.closeBlocked ? (
        <CloseBlockedDialog sessions={state.closeBlocked} onDismiss={actions.dismissCloseBlocked} />
      ) : null}
    </div>
  );
}

export function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
