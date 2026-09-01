export type WorkspaceDestination =
  'missions' | 'sessions' | 'agents' | 'templates' | 'memory' | 'settings';

export interface WorkspaceSelection {
  destination: WorkspaceDestination;
  missionId: string | null;
  sessionId: string | null;
}

export function selectDestination(
  current: WorkspaceSelection,
  destination: WorkspaceDestination,
): WorkspaceSelection {
  return {
    destination,
    missionId: current.missionId,
    sessionId: destination === 'sessions' ? current.sessionId : null,
  };
}

export function selectMission(current: WorkspaceSelection, missionId: string): WorkspaceSelection {
  return {
    destination: 'missions',
    missionId,
    sessionId: null,
  };
}

export function selectSession(current: WorkspaceSelection, sessionId: string): WorkspaceSelection {
  return {
    destination: 'sessions',
    missionId: current.missionId,
    sessionId,
  };
}
