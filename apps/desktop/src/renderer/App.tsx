import { useState } from 'react';
import { api, call, errorCode } from './api.js';
import { CloseBlockedDialog } from './features/control/CloseBlockedDialog.js';
import { AgentLibraryWorkspace } from './features/coordination/AgentLibraryWorkspace.js';
import { MemoryLibraryWorkspace } from './features/coordination/MemoryLibraryWorkspace.js';
import { MissionComposer } from './features/coordination/MissionComposer.js';
import { MissionDetail } from './features/coordination/MissionDetail.js';
import { LaunchDialog } from './features/launch/LaunchDialog.js';
import { MissionContext } from './features/mission-focus/MissionContext.js';
import { MissionContextFrame } from './features/mission-focus/MissionContextFrame.js';
import { MissionRail } from './features/mission-focus/MissionRail.js';
import { MissionWorkspace } from './features/mission-focus/MissionWorkspace.js';
import type { ActionKind } from './features/mission-focus/mission-presentation.js';
import { useMissionWorkspace } from './features/mission-focus/useMissionWorkspace.js';
import { terminalSize } from './features/session/terminal-loader.js';
import { SessionWorkspace } from './features/sessions/SessionWorkspace.js';
import { AppNavigation } from './features/shell/AppNavigation.js';
import { AppShell } from './features/shell/AppShell.js';
import type { WorkspaceDestination } from './features/shell/navigation.js';
import { GuidedSetup } from './features/workspaces/GuidedSetup.js';
import { SetupAttentionSummary } from './features/workspaces/SetupAttentionSummary.js';
import { RecoveryAttentionQueue } from './features/recovery/RecoveryAttentionQueue.js';
import { StoreProvider, useStore } from './store.js';

function currentTerminalSize(sessionId: string | null): { columns: number; rows: number } {
  return (sessionId ? terminalSize(sessionId) : undefined) ?? { columns: 120, rows: 30 };
}

function LegacyDestination({
  mission,
}: {
  mission: ReturnType<typeof useMissionWorkspace>['detail'];
}) {
  const { state } = useStore();
  switch (state.selectedDestination) {
    case 'sessions':
      return <SessionWorkspace mission={mission} />;
    case 'agents':
      return <AgentLibraryWorkspace />;
    case 'templates':
      return <AgentLibraryWorkspace />;
    case 'memory':
      return <MemoryLibraryWorkspace />;
    case 'attention':
      return <RecoveryAttentionQueue />;
    case 'settings':
      return <GuidedSetup />;
    case 'missions':
      return null;
  }
}

const destinationHeading: Record<WorkspaceDestination, string> = {
  missions: 'Mission context',
  sessions: 'Sessions',
  agents: 'Agents',
  templates: 'Templates',
  memory: 'Memory',
  attention: 'Attention',
  settings: 'Settings',
};

function Shell() {
  const { state, actions } = useStore();
  const workspace = useMissionWorkspace(state.selectedMissionId);
  const [creatingMission, setCreatingMission] = useState(false);
  const [detailMissionId, setDetailMissionId] = useState<string | null>(null);
  const missionSelected = state.selectedDestination === 'missions';

  const runMissionAction = (kind: ActionKind) => {
    const missionId = state.selectedMissionId;
    if (!missionId) return;
    if (kind === 'pause') {
      void call(api.missions.pause({ missionId })).catch((cause) =>
        actions.setNotice(`Pausing the mission failed (${errorCode(cause)}).`),
      );
      return;
    }
    setDetailMissionId(missionId);
  };

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
              titles={workspace.titles}
              selectedMissionId={state.selectedMissionId}
              onSelect={actions.selectMission}
              onCreate={() => setCreatingMission(true)}
            />
            <AppNavigation
              selected={state.selectedDestination}
              onSelect={actions.selectDestination}
              counts={{
                sessions: Object.values(state.unread).filter(Boolean).length,
                attention: state.recoveryRecords.filter((record) => record.resolvedAt === null)
                  .length,
              }}
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
              onAction={runMissionAction}
              onOpenTerminal={(sessionId) => {
                actions.select(sessionId);
                actions.selectDestination('sessions');
              }}
            />
          ) : (
            <LegacyDestination mission={workspace.detail} />
          )
        }
        context={
          missionSelected ? (
            <MissionContext
              detail={workspace.detail}
              presentation={workspace.presentation}
              onAction={runMissionAction}
              onOpenAttention={() => actions.selectDestination('attention')}
            />
          ) : (
            <MissionContextFrame heading={destinationHeading[state.selectedDestination]}>
              <SetupAttentionSummary />
            </MissionContextFrame>
          )
        }
        terminal={null}
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
