import { describe, expect, it } from 'vitest';
import {
  selectDestination,
  selectMission,
  selectSession,
  type WorkspaceSelection,
} from '../../../apps/desktop/src/renderer/features/shell/navigation.js';

const current: WorkspaceSelection = {
  destination: 'sessions',
  missionId: 'mission-a',
  sessionId: 'session-a',
};

describe('workspace navigation', () => {
  it('selects the whole mission context and clears a stale session', () => {
    expect(selectMission(current, 'mission-b')).toEqual({
      destination: 'missions',
      missionId: 'mission-b',
      sessionId: null,
    });
  });

  it('selects a session without changing the selected mission', () => {
    expect(selectSession(current, 'session-b')).toEqual({
      destination: 'sessions',
      missionId: 'mission-a',
      sessionId: 'session-b',
    });
  });

  it('changes destination without retaining destination-owned selection', () => {
    expect(selectDestination(current, 'agents')).toEqual({
      destination: 'agents',
      missionId: 'mission-a',
      sessionId: null,
    });
  });

  it('does not mutate the current selection', () => {
    selectMission(current, 'mission-b');
    expect(current).toEqual({
      destination: 'sessions',
      missionId: 'mission-a',
      sessionId: 'session-a',
    });
  });
});
