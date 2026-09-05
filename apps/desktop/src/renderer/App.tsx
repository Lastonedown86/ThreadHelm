import { useCallback, useEffect, useRef, useState } from 'react';
import type { MissionComposerDraftSummaryView } from '@threadhelm/contracts';
import { api, call, errorCode } from './api.js';
import { CloseBlockedDialog } from './features/control/CloseBlockedDialog.js';
import { AgentLibraryWorkspace } from './features/coordination/AgentLibraryWorkspace.js';
import { MemoryLibraryWorkspace } from './features/coordination/MemoryLibraryWorkspace.js';
import { ModalDialog } from './features/coordination/ModalDialog.js';
import { MissionDetail } from './features/coordination/MissionDetail.js';
import { LaunchDialog } from './features/launch/LaunchDialog.js';
import { ComposerContext } from './features/mission-composer/ComposerContext.js';
import type { Stage, WorkerFields } from './features/mission-composer/composer-fields.js';
import { MissionComposerWorkspace } from './features/mission-composer/MissionComposerWorkspace.js';
import { RepoIdeaEntry, type RepoIdeaFields } from './features/mission-composer/RepoIdeaEntry.js';
import { ContextToggle } from './features/mission-focus/ContextToggle.js';
import { MissionContext } from './features/mission-focus/MissionContext.js';
import { MissionContextFrame } from './features/mission-focus/MissionContextFrame.js';
import { MissionRail } from './features/mission-focus/MissionRail.js';
import { MissionWorkspace } from './features/mission-focus/MissionWorkspace.js';
import type { ActionKind } from './features/mission-focus/mission-presentation.js';
import { reasonLabel } from './features/mission-focus/reason-labels.js';
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
  memory: 'Memory',
  attention: 'Attention',
  settings: 'Settings',
};

function Shell() {
  const { state, actions } = useStore();
  const workspace = useMissionWorkspace(state.selectedMissionId);
  const [missionView, setMissionView] = useState<
    { kind: 'mission' } | { kind: 'entry' } | { kind: 'draft'; draftId: string }
  >({ kind: 'mission' });
  const composerDraftId = missionView.kind === 'draft' ? missionView.draftId : null;
  const pickingRepo = missionView.kind === 'entry';
  const [composerState, setComposerState] = useState<{
    stage: Stage;
    workers: WorkerFields[];
  } | null>(null);
  const [detailMissionId, setDetailMissionId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<MissionComposerDraftSummaryView[]>([]);
  const missionSelected = state.selectedDestination === 'missions';
  const composerFlush = useRef<(() => Promise<boolean>) | null>(null);
  const setComposerFlush = useCallback((flush: (() => Promise<boolean>) | null) => {
    composerFlush.current = flush;
  }, []);
  type NavigationAction = () => void | Promise<void>;
  const pendingNavigation = useRef<NavigationAction | null>(null);
  const navigationBusy = useRef(false);
  const [leaving, setLeaving] = useState(false);
  const [saveBlocked, setSaveBlocked] = useState(false);

  const attemptNavigation = useCallback(
    async (target: NavigationAction, leaveUnsaved = false) => {
      if (navigationBusy.current) return false;
      navigationBusy.current = true;
      pendingNavigation.current = target;
      setLeaving(true);
      try {
        if (!leaveUnsaved && composerFlush.current) {
          const saved = await composerFlush.current().catch(() => false);
          if (!saved) {
            setSaveBlocked(true);
            return false;
          }
        }
        await target();
        pendingNavigation.current = null;
        setSaveBlocked(false);
        return true;
      } catch (cause) {
        pendingNavigation.current = null;
        setSaveBlocked(false);
        actions.setNotice(
          reasonLabel(errorCode(cause)) ?? 'The requested view could not be opened.',
        );
        return false;
      } finally {
        navigationBusy.current = false;
        setLeaving(false);
      }
    },
    [actions],
  );
  const navigate = useCallback(
    (target: NavigationAction) => {
      // One pending action owns its target, even if another rail control is pressed.
      if (pendingNavigation.current) return Promise.resolve(false);
      return attemptNavigation(target);
    },
    [attemptNavigation],
  );
  const keepEditing = () => {
    if (navigationBusy.current) return;
    pendingNavigation.current = null;
    setSaveBlocked(false);
  };
  const showMission = () => {
    setMissionView({ kind: 'mission' });
    setComposerState(null);
  };
  const selectMission = (id: string) =>
    navigate(() => {
      showMission();
      actions.selectMission(id);
    });
  const selectDestination = (destination: WorkspaceDestination) => {
    if (destination === state.selectedDestination && destination !== 'sessions') return;
    void navigate(() => actions.selectDestination(destination));
  };
  const newMission = () =>
    void navigate(() => {
      setMissionView({ kind: 'entry' });
      setComposerState(null);
      actions.selectDestination('missions');
    });

  useEffect(() => {
    if (state.storageDegraded) {
      setDrafts([]);
      return;
    }
    let cancelled = false;
    void call(api.missionComposer.listDrafts(undefined))
      .then((page) => !cancelled && setDrafts(page.drafts))
      .catch(() => !cancelled && setDrafts([]));
    return () => {
      cancelled = true;
    };
  }, [state.missionSequence, state.composerSequence, state.storageDegraded]);

  const openComposer = (sourceMissionId?: string, initialFields?: RepoIdeaFields) => {
    void navigate(async () => {
      const draft = await call(
        api.missionComposer.createDraft(sourceMissionId ? { sourceMissionId } : undefined),
      );
      if (initialFields) {
        await call(
          api.missionComposer.updateDraft({
            draftId: draft.draftId,
            expectedVersion: draft.version,
            fieldValues: initialFields,
            currentStage: 'outcome',
          }),
        );
      }
      setMissionView({ kind: 'draft', draftId: draft.draftId });
      setComposerState(null);
      setDetailMissionId(null);
      actions.selectDestination('missions');
    });
  };
  const resumeDraft = (draftId: string) => {
    if (missionSelected && composerDraftId === draftId) return;
    void navigate(() => {
      setMissionView({ kind: 'draft', draftId });
      setComposerState(null);
      actions.selectDestination('missions');
    });
  };

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

  const contextContent =
    missionSelected && composerDraftId && composerState ? (
      <ComposerContext stage={composerState.stage} workers={composerState.workers} />
    ) : missionSelected && missionView.kind !== 'mission' ? (
      <MissionContextFrame heading={pickingRepo ? 'New mission' : 'Mission draft'}>
        <p>
          {pickingRepo
            ? 'Choose a repository for ideas, or write your own mission.'
            : 'Loading draft context…'}
        </p>
      </MissionContextFrame>
    ) : missionSelected ? (
      <MissionContext
        detail={workspace.detail}
        presentation={workspace.presentation}
        onAction={runMissionAction}
        onOpenAttention={() => selectDestination('attention')}
      />
    ) : (
      <MissionContextFrame heading={destinationHeading[state.selectedDestination]}>
        <SetupAttentionSummary />
      </MissionContextFrame>
    );

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
              selectedMissionId={
                missionSelected && missionView.kind === 'mission' ? state.selectedMissionId : null
              }
              onSelect={selectMission}
              onCreate={newMission}
              drafts={drafts}
              onResumeDraft={resumeDraft}
            />
            <AppNavigation
              selected={state.selectedDestination}
              onSelect={selectDestination}
              counts={{
                sessions: Object.values(state.unread).filter(Boolean).length,
                attention: state.recoveryRecords.filter((record) => record.resolvedAt === null)
                  .length,
              }}
            />
          </>
        }
        workspace={
          state.selectedDestination !== 'missions' ? (
            <LegacyDestination mission={workspace.detail} />
          ) : pickingRepo ? (
            <RepoIdeaEntry
              workspaces={state.workspaces}
              readiness={state.readiness}
              onSkip={() => openComposer()}
              onPick={(fields) => openComposer(undefined, fields)}
              onGoToSettings={() => selectDestination('settings')}
            />
          ) : composerDraftId ? (
            <MissionComposerWorkspace
              key={composerDraftId}
              draftId={composerDraftId}
              onClose={showMission}
              onStarted={(mission) => {
                showMission();
                actions.selectMission(mission.id);
                setDetailMissionId(mission.id);
              }}
              onState={setComposerState}
              onFlushReady={setComposerFlush}
            />
          ) : missionSelected ? (
            <MissionWorkspace
              workspace={workspace}
              onOpenDetail={() => {
                if (state.selectedMissionId) setDetailMissionId(state.selectedMissionId);
              }}
              onAction={runMissionAction}
              onOpenTerminal={(sessionId) => {
                actions.select(sessionId);
                actions.selectDestination('sessions');
                actions.setSessionScope('mission');
              }}
            />
          ) : (
            <LegacyDestination mission={workspace.detail} />
          )
        }
        contextToggle={
          <ContextToggle
            label={
              (missionSelected && missionView.kind === 'mission'
                ? workspace.presentation?.attentionLabel
                : null) ?? 'Context'
            }
            attention={
              (missionSelected && missionView.kind === 'mission'
                ? workspace.presentation?.attention
                : null) ?? 'none'
            }
          >
            {contextContent}
          </ContextToggle>
        }
        context={contextContent}
        terminal={null}
      />
      <footer className="status-bar">
        {state.appInfo
          ? `ThreadHelm v${state.appInfo.version} · Electron ${state.appInfo.electronVersion} · ${state.appInfo.arch}`
          : 'ThreadHelm'}
      </footer>
      {detailMissionId ? (
        <MissionDetail
          missionId={detailMissionId}
          onClose={() => setDetailMissionId(null)}
          onRevise={(id) => openComposer(id)}
        />
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
            void navigate(() => actions.selectDestination('sessions'));
            if (recordId) {
              void call(api.recovery.resolve({ recordId, resolution: 'superseded_by_new_session' }))
                .then((record) => actions.recoveryChanged(record))
                .catch(() => undefined);
            }
          }}
        />
      ) : null}
      {saveBlocked ? (
        <ModalDialog label="Unsaved mission changes" onDismiss={keepEditing}>
          <h2>Your latest mission edits could not be saved.</h2>
          <p>
            Keep editing or retry saving before continuing. Leaving without saving keeps only the
            last saved version of this draft.
          </p>
          <div className="mission-action-row">
            <button type="button" onClick={keepEditing} disabled={leaving}>
              Keep editing
            </button>
            <button
              type="button"
              disabled={leaving}
              onClick={() => {
                const target = pendingNavigation.current;
                if (target) void attemptNavigation(target);
              }}
            >
              Retry
            </button>
            <button
              type="button"
              className="danger"
              disabled={leaving}
              onClick={() => {
                const target = pendingNavigation.current;
                if (target) void attemptNavigation(target, true);
              }}
            >
              Leave without saving
            </button>
          </div>
        </ModalDialog>
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
