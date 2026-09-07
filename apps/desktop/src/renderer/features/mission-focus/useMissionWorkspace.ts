import { useEffect, useMemo, useState } from 'react';
import type { MissionDetailView, MissionSummaryView } from '@threadhelm/contracts';
import { api, call } from '../../api.js';
import { useStore } from '../../store.js';
import {
  liveSessionIds,
  missionTitle,
  missionInventoryStatus,
  presentMission,
  type MissionPresentation,
} from './mission-presentation.js';

export interface MissionWorkspaceState {
  missions: MissionSummaryView[];
  /** Rail titles by mission id. Summaries are content-free by contract, so the objective is read through detail. */
  titles: Record<string, string>;
  statuses: Record<string, string>;
  detail: MissionDetailView | null;
  presentation: MissionPresentation | null;
  loading: boolean;
  error: unknown;
}

function titleKey(mission: MissionSummaryView): string {
  return `${mission.id}:${mission.version}:${mission.state}:${mission.sequence}`;
}

export function useMissionWorkspace(selectedMissionId: string | null): MissionWorkspaceState {
  const { state, actions } = useStore();
  const [missions, setMissions] = useState<MissionSummaryView[]>([]);
  const [titleCache, setTitleCache] = useState<Record<string, { title: string; status: string }>>(
    {},
  );
  const [detail, setDetail] = useState<MissionDetailView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void call(api.missions.list({ limit: 100 }))
      .then((list) => {
        if (cancelled) return;
        setMissions(list);
        setError(null);
        if (!selectedMissionId && list[0]) actions.selectMission(list[0].id);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [actions, selectedMissionId, state.missionSequence]);

  useEffect(() => {
    const missing = missions.filter((mission) => !(titleKey(mission) in titleCache));
    if (missing.length === 0) return;
    let cancelled = false;
    void (async () => {
      const next: Record<string, { title: string; status: string }> = {};
      for (const mission of missing) {
        try {
          const view = await call(api.missions.detail({ missionId: mission.id }));
          const presentation = presentMission(view);
          next[titleKey(mission)] = {
            title: missionTitle(view.envelope?.objective, mission.id),
            status: missionInventoryStatus(view, presentation),
          };
        } catch {
          next[titleKey(mission)] = {
            title: missionTitle(null, mission.id),
            status: `${mission.state.replaceAll('_', ' ')} · Details unavailable`,
          };
        }
      }
      if (!cancelled)
        setTitleCache((old) =>
          Object.fromEntries(
            missions.map((mission) => {
              const key = titleKey(mission);
              return [key, next[key] ?? old[key]!];
            }),
          ),
        );
    })();
    return () => {
      cancelled = true;
    };
  }, [missions, titleCache]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedMissionId) {
      setDetail(null);
      return () => {
        cancelled = true;
      };
    }
    setLoading(true);
    void call(api.missions.detail({ missionId: selectedMissionId }))
      .then((value) => {
        if (!cancelled) {
          setDetail(value);
          setError(null);
        }
      })
      .catch((cause) => {
        if (!cancelled) setError(cause);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedMissionId, state.missionSequence]);

  const titles: Record<string, string> = {};
  const statuses: Record<string, string> = {};
  for (const mission of missions) {
    const cached = titleCache[titleKey(mission)];
    if (cached) {
      titles[mission.id] = cached.title;
      statuses[mission.id] = cached.status;
    }
  }

  // Shell re-renders on every terminal-output chunk; presentMission is O(workItems x
  // attempts), so only recompute it when the inputs it actually reads have changed.
  const presentation = useMemo(
    () => (detail ? presentMission(detail, { liveSessionIds: liveSessionIds(state) }) : null),
    [detail, state.sessionOrder, state.sessions],
  );

  if (detail && detail.id === selectedMissionId && presentation) {
    titles[detail.id] = presentation.title;
    statuses[detail.id] = missionInventoryStatus(detail, presentation);
  }

  return {
    missions,
    titles,
    statuses,
    detail,
    presentation,
    loading,
    error,
  };
}
