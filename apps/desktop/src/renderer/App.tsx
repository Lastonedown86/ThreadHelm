import { useState } from 'react';
import { api, call } from './api.js';
import { CloseBlockedDialog } from './features/control/CloseBlockedDialog.js';
import { ControlBar } from './features/control/ControlBar.js';
import { AgentProfileList } from './features/coordination/AgentProfileList.js';
import { AgentTemplateLibrary } from './features/coordination/AgentTemplateLibrary.js';
import { CoordinationPanel } from './features/coordination/CoordinationPanel.js';
import { ConversationView } from './features/coordination/ConversationView.js';
import { MemoryList } from './features/coordination/MemoryList.js';
import { MissionComposer } from './features/coordination/MissionComposer.js';
import { MissionDetail } from './features/coordination/MissionDetail.js';
import { LaunchDialog } from './features/launch/LaunchDialog.js';
import { MissionContext } from './features/mission-focus/MissionContext.js';
import { MissionRail } from './features/mission-focus/MissionRail.js';
import { MissionWorkspace } from './features/mission-focus/MissionWorkspace.js';
import { useMissionWorkspace } from './features/mission-focus/useMissionWorkspace.js';
import { RecoveryPanel } from './features/recovery/RecoveryPanel.js';
import { LazyTerminalPane } from './features/session/LazyTerminal.js';
import { terminalSize } from './features/session/terminal-loader.js';
import { SessionList } from './features/sessions/SessionList.js';
import { AppNavigation } from './features/shell/AppNavigation.js';
import { AppShell } from './features/shell/AppShell.js';
import { ProviderReadiness } from './features/workspaces/ProviderReadiness.js';
import { WorkspacePanel } from './features/workspaces/WorkspacePanel.js';
import { StoreProvider, useStore } from './store.js';

function currentTerminalSize(sessionId: string | null): { columns: number; rows: number } {
  return (sessionId ? terminalSize(sessionId) : undefined) ?? { columns: 120, rows: 30 };
}

function LegacyDestination() {
  const { state } = useStore();
  const selected = state.selectedSessionId ? state.sessions[state.selectedSessionId] : undefined;
  switch (state.selectedDestination) {
    case 'sessions':
      return (
        <div className="legacy-destination">
          <RecoveryPanel />
          <WorkspacePanel />
          <ProviderReadiness />
          <SessionList />
          <CoordinationPanel />
          <ConversationView />
          {selected ? (
            <header className="session-header">
              <h1>
                {selected.providerDisplayName}{' '}
                <span className="mono small-text">{selected.workspaceDisplayPath}</span>
              </h1>
              <ControlBar key={selected.id} session={selected} />
            </header>
          ) : null}
        </div>
      );
    case 'agents':
      return <AgentProfileList />;
    case 'templates':
      return <AgentTemplateLibrary />;
    case 'memory':
      return <MemoryList />;
    case 'settings':
      return (
        <div className="legacy-destination">
          <WorkspacePanel />
          <ProviderReadiness />
        </div>
      );
    case 'missions':
      return null;
  }
}

function Shell() {
  const { state, actions } = useStore();
  const workspace = useMissionWorkspace(state.selectedMissionId);
  const [creatingMission, setCreatingMission] = useState(false);
  const [detailMissionId, setDetailMissionId] = useState<string | null>(null);
  const selected = state.selectedSessionId ? state.sessions[state.selectedSessionId] : undefined;
  const missionSelected = state.selectedDestination === 'missions';

  return (
    <div className="app">
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
      <AppShell
        rail={
          <>
            <MissionRail
              missions={workspace.missions}
              selectedMissionId={state.selectedMissionId}
              onSelect={actions.selectMission}
              onCreate={() => setCreatingMission(true)}
            />
            <AppNavigation
              selected={state.selectedDestination}
              onSelect={actions.selectDestination}
            />
          </>
        }
        workspace={
          missionSelected ? (
            <MissionWorkspace
              workspace={workspace}
              onCreate={() => setCreatingMission(true)}
              onOpenDetail={() => {
                if (state.selectedMissionId) setDetailMissionId(state.selectedMissionId);
              }}
            />
          ) : (
            <LegacyDestination />
          )
        }
        context={
          missionSelected ? (
            <MissionContext detail={workspace.detail} presentation={workspace.presentation} />
          ) : (
            <p className="mission-workspace-state">
              Existing {state.selectedDestination} controls remain unchanged during design review.
            </p>
          )
        }
        terminal={
          state.selectedDestination === 'sessions' && selected ? (
            <LazyTerminalPane
              session={selected}
              truncationCount={state.truncation[selected.id] ?? selected.truncationCount}
              streamFailure={state.streamFailed[selected.id] ?? null}
              inputNotice={state.inputNotice[selected.id] ?? null}
            />
          ) : null
        }
      />
      <footer className="status-bar">
        {state.appInfo
          ? `ThreadHelm v${state.appInfo.version} · Electron ${state.appInfo.electronVersion} · ${state.appInfo.arch}`
          : 'ThreadHelm'}
      </footer>
      {creatingMission ? (
        <MissionComposer
          onClose={() => setCreatingMission(false)}
          onSaved={(mission) => {
            actions.selectMission(mission.id);
            setCreatingMission(false);
            setDetailMissionId(mission.id);
          }}
        />
      ) : null}
      {detailMissionId ? (
        <MissionDetail missionId={detailMissionId} onClose={() => setDetailMissionId(null)} />
      ) : null}
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
            actions.selectDestination('sessions');
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
