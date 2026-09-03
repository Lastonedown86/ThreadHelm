import { useEffect, useState } from 'react';
import type { MissionSummaryView } from '@threadhelm/contracts';
import { api, call } from '../../api.js';
import { useStore } from '../../store.js';
import { LaunchError } from '../launch/LaunchErrors.js';
import { MissionComposer } from './MissionComposer.js';
import { MissionDetail } from './MissionDetail.js';

export function MissionList() {
  const { state } = useStore();
  const [missions, setMissions] = useState<MissionSummaryView[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState('all');
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    let cancelled = false;
    void call(api.missions.list({ limit: 100 }))
      .then((list) => {
        if (!cancelled) {
          setMissions(list);
          setError(null);
        }
      })
      .catch((cause) => {
        if (!cancelled) setError(cause);
      });
    return () => {
      cancelled = true;
    };
  }, [state.missionSequence, refresh]);
  return (
    <section className="panel missions" aria-labelledby="missions-heading">
      <div className="panel-heading">
        <h2 id="missions-heading">Missions</h2>
        <button
          className="small"
          disabled={state.storageDegraded}
          onClick={() => setCreating(true)}
        >
          New mission…
        </button>
      </div>
      <p className="hint">Bounded work inside an exact, reviewed mission envelope.</p>
      <LaunchError error={error} />
      <label>
        Mission status
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          {['all', 'running', 'paused', 'recovery_required', 'completed', 'cancelled'].map(
            (status) => (
              <option key={status} value={status}>
                {status.replaceAll('_', ' ')}
              </option>
            ),
          )}
        </select>
      </label>
      {!missions.length ? (
        <p className="hint">No missions yet. Creating a profile does not start a mission.</p>
      ) : null}
      <ul className="list" aria-label="Missions">
        {missions
          .filter((m) => filter === 'all' || m.state === filter)
          .map((mission) => (
            <li key={mission.id}>
              <button className="small" onClick={() => setSelected(mission.id)}>
                Mission {mission.id.slice(0, 8)}
              </button>{' '}
              <span className="badge">{mission.state.replaceAll('_', ' ')}</span>
              <p className="hint">
                {mission.completedWorkItemCount}/{mission.workItemCount} items complete ·{' '}
                {mission.activeWorkerCount} active workers · version {mission.version}
              </p>
              {mission.reasonCode ? <p className="hint">{mission.reasonCode}</p> : null}
            </li>
          ))}
      </ul>
      <button className="small" onClick={() => setRefresh((n) => n + 1)}>
        Refresh missions
      </button>
      {creating ? (
        <MissionComposer
          onClose={() => setCreating(false)}
          onSaved={(mission) => {
            setCreating(false);
            setSelected(mission.id);
            setRefresh((n) => n + 1);
          }}
        />
      ) : null}
      {selected ? (
        <MissionDetail
          missionId={selected}
          onClose={() => {
            setSelected(null);
            setRefresh((n) => n + 1);
          }}
          // ponytail: this legacy list is unmounted dead code (superseded by
          // the Mission Focus workspace); revision here is a no-op.
          onRevise={() => undefined}
        />
      ) : null}
    </section>
  );
}
