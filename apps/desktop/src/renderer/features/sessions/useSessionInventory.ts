import { useState } from 'react';
import type { LifecycleState, SessionView } from '@threadhelm/contracts';
import { useStore } from '../../store.js';

const ENDED: ReadonlySet<LifecycleState> = new Set(['stopped', 'failed', 'recovery_required']);

/** One visibility policy for list, tabs and selected dock. Hiding never mutates sessions. */
export function useSessionInventory(sessions: SessionView[]) {
  const { state, actions } = useStore();
  const [expanded, setExpanded] = useState(false);
  const live = sessions.filter((session) => !ENDED.has(session.lifecycleState));
  const ended = sessions.filter((session) => ENDED.has(session.lifecycleState));
  const selectedEnded = ended.some((session) => session.id === state.selectedSessionId);
  const endedShown = expanded || selectedEnded;
  return {
    sessions: endedShown ? [...live, ...ended] : live,
    liveCount: live.length,
    totalCount: sessions.length,
    endedCount: ended.length,
    endedShown,
    toggleEnded() {
      if (endedShown && selectedEnded) actions.select(live[0]?.id ?? null);
      setExpanded(!endedShown);
    },
  };
}

export type SessionInventory = ReturnType<typeof useSessionInventory>;
