import { useEffect, useState, type KeyboardEvent } from 'react';
import type {
  AgentProfileSummaryView,
  ProfilePreviewView,
  ProfileState,
} from '@threadhelm/contracts';
import { api, call, errorCode } from '../../api.js';
import { useStore } from '../../store.js';
import { LaunchError } from '../launch/LaunchErrors.js';
import { AgentProfileDetail, AgentProfileImportPreview } from './AgentProfileDetail.js';

const COMPATIBILITY_LABEL: Record<string, string> = {
  compatible: 'Compatible',
  incompatible_provider: 'Incompatible provider',
  incompatible_model: 'Incompatible model',
  unavailable: 'Unavailable',
};

function upsert(
  profiles: AgentProfileSummaryView[],
  summary: AgentProfileSummaryView,
): AgentProfileSummaryView[] {
  const index = profiles.findIndex((profile) => profile.profileId === summary.profileId);
  if (index === -1) return [summary, ...profiles];
  const next = profiles.slice();
  next[index] = summary;
  return next;
}

export function AgentProfileList() {
  const { state } = useStore();
  const [profiles, setProfiles] = useState<AgentProfileSummaryView[]>([]);
  const [filterState, setFilterState] = useState<ProfileState | ''>('');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ProfilePreviewView | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    void call(api.profiles.list(filterState ? { state: filterState } : {}))
      .then((result) => {
        if (!cancelled) setProfiles(result.profiles);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause);
      });
    return () => {
      cancelled = true;
    };
    // A content-free event is only a reload signal; no event body enters renderer state.
  }, [filterState, state.profilesSequence]);

  const choose = async () => {
    setError(null);
    try {
      const { fileHandle } = await call(api.profiles.chooseFile(undefined));
      setPreview(await call(api.profiles.previewImport({ fileHandle })));
    } catch (cause) {
      if (errorCode(cause) !== 'SELECTION_CANCELLED') setError(cause);
    }
  };

  const selectOnKeyDown = (event: KeyboardEvent<HTMLLIElement>, profileId: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    setSelectedProfileId(profileId);
  };

  return (
    <section className="panel profiles-panel" aria-labelledby="profiles-heading">
      <div className="panel-heading">
        <h2 id="profiles-heading">Agent roster</h2>
        <button
          type="button"
          className="small"
          disabled={state.storageDegraded}
          onClick={() => void choose()}
        >
          Import profile…
        </button>
      </div>
      <label className="field compact">
        Filter
        <select
          value={filterState}
          onChange={(event) => setFilterState(event.target.value as ProfileState | '')}
        >
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
      </label>
      <LaunchError error={error} />
      {profiles.length === 0 ? <p className="hint">No reviewed agent profiles yet.</p> : null}
      <ul className="list profiles" aria-label="Reviewed agent profiles">
        {profiles.map((profile) => (
          <li
            key={profile.profileId}
            tabIndex={0}
            className={profile.profileId === selectedProfileId ? 'selected' : undefined}
            onClick={() => setSelectedProfileId(profile.profileId)}
            onKeyDown={(event) => selectOnKeyDown(event, profile.profileId)}
          >
            <strong>{profile.displayName}</strong>{' '}
            <span className={`badge profile-${profile.compatibility}`}>
              {COMPATIBILITY_LABEL[profile.compatibility] ?? profile.compatibility}
            </span>{' '}
            {profile.state === 'disabled' ? <span className="badge">Disabled</span> : null}
            <div className="hint">
              {profile.requestedProvider} · {profile.requestedModel} · {profile.digestPrefix}
            </div>
          </li>
        ))}
      </ul>
      {selectedProfileId ? (
        <AgentProfileDetail
          profileId={selectedProfileId}
          reloadSequence={state.profilesSequence}
          onChanged={(summary) => setProfiles((current) => upsert(current, summary))}
        />
      ) : null}
      {preview ? (
        <AgentProfileImportPreview
          preview={preview}
          onCancel={() => setPreview(null)}
          onImported={(summary) => {
            setPreview(null);
            setProfiles((current) => upsert(current, summary));
            setSelectedProfileId(summary.profileId);
          }}
        />
      ) : null}
    </section>
  );
}
