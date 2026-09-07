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
  selectedMissionId: string | null;
  retry(): void;
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
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<unknown>(null);
  const [refresh, setRefresh] = useState(0);
  const [selection, setSelection] = useState<{
    id: string | null;
    detail: MissionDetailView | null;
    loading: boolean;
    error: unknown;
  }>({ id: null, detail: null, loading: false, error: null });

  useEffect(() => {
    let cancelled = false;
    setListLoading(true);
    void call(api.missions.list({ limit: 100 }))
      .then((list) => {
        if (cancelled) return;
        setMissions(list);
        setListError(null);
      })
      .catch((cause) => {
        if (!cancelled) setListError(cause);
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [state.missionSequence, refresh]);

  useEffect(() => {
    if (!selectedMissionId && missions[0]) actions.selectMission(missions[0].id);
  }, [actions, selectedMissionId, missions]);

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
    setSelection({
      id: selectedMissionId,
      detail: null,
      loading: !!selectedMissionId,
      error: null,
    });
    if (selectedMissionId)
      void call(api.missions.detail({ missionId: selectedMissionId }))
        .then((value) => {
          if (!cancelled)
            setSelection({ id: selectedMissionId, detail: value, loading: false, error: null });
        })
        .catch((error) => {
          if (!cancelled)
            setSelection({ id: selectedMissionId, detail: null, loading: false, error });
        });
    return () => {
      cancelled = true;
    };
  }, [selectedMissionId, state.missionSequence, refresh]);

  // Gate synchronously on identity, before the selection effect gets a chance to run.
  const current = selection.id === selectedMissionId;
  const detail = current && !selection.error ? selection.detail : null;
  const loading = listLoading || (!!selectedMissionId && (!current || selection.loading));
  const error = listError ?? (current ? selection.error : null);

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
    selectedMissionId,
    retry: () => setRefresh((value) => value + 1),
  };
}
