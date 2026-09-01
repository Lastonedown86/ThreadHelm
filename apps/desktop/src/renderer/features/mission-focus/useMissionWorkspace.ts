import { useEffect, useState } from 'react';
import type { MissionDetailView, MissionSummaryView } from '@threadhelm/contracts';
import { api, call } from '../../api.js';
import { useStore } from '../../store.js';
import { presentMission, type MissionPresentation } from './mission-presentation.js';

export interface MissionWorkspaceState {
  missions: MissionSummaryView[];
  detail: MissionDetailView | null;
  presentation: MissionPresentation | null;
  loading: boolean;
  error: unknown;
}

export function useMissionWorkspace(selectedMissionId: string | null): MissionWorkspaceState {
  const { state, actions } = useStore();
  const [missions, setMissions] = useState<MissionSummaryView[]>([]);
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

  return {
    missions,
    detail,
    presentation: detail ? presentMission(detail) : null,
    loading,
    error,
  };
}
