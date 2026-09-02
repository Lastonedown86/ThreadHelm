import { useEffect, useState } from 'react';
import type { MissionDetailView, MissionSummaryView } from '@threadhelm/contracts';
import { api, call } from '../../api.js';
import { useStore } from '../../store.js';
import { missionTitle, presentMission, type MissionPresentation } from './mission-presentation.js';

export interface MissionWorkspaceState {
  missions: MissionSummaryView[];
  /** Rail titles by mission id. Summaries are content-free by contract, so the objective is read through detail. */
  titles: Record<string, string>;
  detail: MissionDetailView | null;
  presentation: MissionPresentation | null;
  loading: boolean;
  error: unknown;
}

function titleKey(mission: MissionSummaryView): string {
  return `${mission.id}:${mission.version}:${mission.state}`;
}

export function useMissionWorkspace(selectedMissionId: string | null): MissionWorkspaceState {
  const { state, actions } = useStore();
  const [missions, setMissions] = useState<MissionSummaryView[]>([]);
  const [titleCache, setTitleCache] = useState<Record<string, string>>({});
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
      const next: Record<string, string> = {};
      for (const mission of missing) {
        try {
          const view = await call(api.missions.detail({ missionId: mission.id }));
          next[titleKey(mission)] = missionTitle(view.envelope?.objective, mission.id);
        } catch {
          next[titleKey(mission)] = missionTitle(null, mission.id);
        }
      }
      if (!cancelled) setTitleCache((old) => ({ ...old, ...next }));
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
  for (const mission of missions) {
    const cached = titleCache[titleKey(mission)];
    if (cached) titles[mission.id] = cached;
  }

  return {
    missions,
    titles,
    detail,
    presentation: detail ? presentMission(detail) : null,
    loading,
    error,
  };
}
