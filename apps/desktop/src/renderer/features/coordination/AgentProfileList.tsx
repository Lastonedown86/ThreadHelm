import { useEffect, useState, type KeyboardEvent } from 'react';
import type {
  AgentProfileSummaryView,
  ProfilePreviewView,
  ProfileState,
  OperationResponse,
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

  const [pageCount, setPageCount] = useState(1);
  const [retry, setRetry] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState({ filter: '', sequence: -1, key: '' });
  const [loadError, setLoadError] = useState<{ key: string; cause: unknown } | null>(null);
  const requestKey = `${filterState}:${state.profilesSequence}:${pageCount}:${retry}`;
  const current = loaded.filter === filterState && loaded.sequence === state.profilesSequence;
  const failed = loadError?.key === requestKey;
  const pending = loaded.key !== requestKey && !failed;
  const visibleProfiles = current ? profiles : [];

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // Refresh every requested page after events: an updated profile can move
      // across cursor boundaries. Publish the reconciled inventory atomically.
      const found = new Map<string, AgentProfileSummaryView>();
      let cursor: string | null = null;
      for (let page = 0; page < pageCount; page++) {
        const result: OperationResponse<'profiles.list'> = await call(
          api.profiles.list({
            limit: 50,
            ...(filterState ? { state: filterState } : {}),
            ...(cursor ? { cursor } : {}),
          }),
        );
        if (cancelled) return;
        for (const profile of result.profiles) found.set(profile.profileId, profile);
        cursor = result.nextCursor;
        if (!cursor) break;
      }
      setProfiles([...found.values()]);
      setNextCursor(cursor);
      setLoaded({ filter: filterState, sequence: state.profilesSequence, key: requestKey });
      setSelectedProfileId((id) => (id && found.has(id) ? id : null));
      setLoadError(null);
    };
    void load().catch((cause) => {
      if (!cancelled) setLoadError({ key: requestKey, cause });
    });
    return () => {
      cancelled = true;
    };
  }, [filterState, state.profilesSequence, pageCount, requestKey]);

  const changeFilter = (filter: ProfileState | '') => {
    setFilterState(filter);
    setPageCount(1);
    const selected = profiles.find((profile) => profile.profileId === selectedProfileId);
    if (filter && selected?.state !== filter) setSelectedProfileId(null);
  };

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
          aria-label="Profile filter"
          value={filterState}
          onChange={(event) => changeFilter(event.target.value as ProfileState | '')}
        >
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
      </label>
      <LaunchError error={error} />
      {pending ? <p role="status">Loading profiles...</p> : null}
      {failed ? (
        <>
          <LaunchError error={loadError.cause} />
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            Retry profiles
          </button>
        </>
      ) : null}
      {!pending && !failed && visibleProfiles.length === 0 ? (
        <>
          <p className="hint">
            {filterState ? `No ${filterState} profiles.` : 'No reviewed agent profiles yet.'}
          </p>
          {filterState ? (
            <button type="button" onClick={() => changeFilter('')}>
              Show all profiles
            </button>
          ) : null}
        </>
      ) : null}
      {current && visibleProfiles.length > 0 ? (
        <p className="hint">
          {visibleProfiles.length} profiles shown{nextCursor ? ' - more available' : ''}
        </p>
      ) : null}
      <ul className="list profiles" aria-label="Reviewed agent profiles">
        {visibleProfiles.map((profile) => (
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
      {current && nextCursor ? (
        <button
          type="button"
          disabled={pending || failed}
          onClick={() => setPageCount((value) => value + 1)}
        >
          Load more profiles
        </button>
      ) : null}
      {current &&
      selectedProfileId &&
      visibleProfiles.some((profile) => profile.profileId === selectedProfileId) ? (
        <AgentProfileDetail
          key={selectedProfileId}
          profileId={selectedProfileId}
          reloadSequence={state.profilesSequence}
          onChanged={() => setRetry((value) => value + 1)}
        />
      ) : null}
      {preview ? (
        <AgentProfileImportPreview
          preview={preview}
          onCancel={() => setPreview(null)}
          onImported={(summary) => {
            setPreview(null);
            changeFilter('');
            setRetry((value) => value + 1);
            setProfiles((current) => upsert(current, summary));
            setSelectedProfileId(summary.profileId);
          }}
        />
      ) : null}
    </section>
  );
}
