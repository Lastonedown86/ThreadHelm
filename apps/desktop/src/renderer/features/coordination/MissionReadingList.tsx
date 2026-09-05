import { useEffect, useState } from 'react';
import type { MemorySummaryView } from '@threadhelm/contracts';
import { api, call } from '../../api.js';
import { useStore, type ReadingListReference } from '../../store.js';

type Metadata = Pick<MemorySummaryView, 'title' | 'status' | 'expiresAt'>;

function ReadingEdition({
  item,
  onRemove,
}: {
  item: ReadingListReference;
  onRemove(id: string): void;
}) {
  const { state } = useStore();
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; metadata: Metadata | null } | null>(null);
  const approved = state.workspaces.some((w) => w.id === item.scope.workspaceId && !w.revokedAt);
  const key = `${item.revisionId}:${state.memorySequence}:${approved}:${retry}`;
  useEffect(() => {
    let cancelled = false;
    setResult(null);
    if (!approved) return;
    void call(api.memory.get(item))
      .then((detail) => {
        if (!cancelled)
          setResult({
            key,
            metadata: {
              expiresAt: detail.summary.expiresAt,
              title: detail.summary.status === 'deleted' ? null : detail.summary.title,
              status:
                detail.summary.status === 'deleted' || detail.summary.status === 'expired'
                  ? detail.summary.status
                  : (detail.lineage.find((revision) => revision.id === item.revisionId)?.status ??
                    detail.summary.status),
            },
          });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, metadata: null });
      });
    return () => {
      cancelled = true;
    };
  }, [item, key, approved]);
  const current = result?.key === key ? result : null;
  const unavailable = !approved || (current && !current.metadata);
  const metadata = approved ? current?.metadata : null;
  useEffect(() => {
    if (!metadata?.expiresAt || metadata.status === 'expired' || metadata.status === 'deleted')
      return;
    // One deadline refresh, not polling: main still determines expiration.
    const delay = Math.max(0, Date.parse(metadata.expiresAt) - Date.now());
    const timer = window.setTimeout(() => setRetry((n) => n + 1), Math.min(delay, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [metadata]);
  return (
    <li>
      {metadata ? (
        <>
          <strong>
            {metadata.status === 'deleted'
              ? 'Deleted content'
              : (metadata.title ?? 'Untitled memory')}
          </strong>{' '}
          <span className={`badge memory-${metadata.status}`}>{metadata.status}</span>
          {metadata.status !== 'active' ? (
            <p className="notice warning">
              This edition is {metadata.status}. Review its lifecycle before using it as evidence.
            </p>
          ) : null}
        </>
      ) : (
        <p className="hint" role="status">
          {unavailable
            ? 'Edition unavailable. Its current lifecycle could not be verified.'
            : 'Checking edition…'}
        </p>
      )}
      <div className="mono small-text">edition {item.revisionId}</div>
      {unavailable && approved ? (
        <button type="button" className="small" onClick={() => setRetry((n) => n + 1)}>
          Retry edition
        </button>
      ) : null}
      {!approved ? (
        <p className="hint">This workspace is not approved. Review folder access in Settings.</p>
      ) : null}
      <button type="button" className="small" onClick={() => onRemove(item.revisionId)}>
        Remove
      </button>
    </li>
  );
}

export function MissionReadingList({
  items,
  onRemove,
}: {
  items: ReadingListReference[];
  onRemove(revisionId: string): void;
}) {
  return (
    <section className="mission-reading-list" aria-labelledby="reading-list-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Temporary selection</p>
          <h2 id="reading-list-heading">Reading list</h2>
        </div>
        <strong>
          {items.length} {items.length === 1 ? 'edition' : 'editions'}
        </strong>
      </div>
      <p className="hint">
        Kept while you navigate this app session. Cleared when the app restarts. Not saved with a
        mission.
      </p>
      {items.length === 0 ? (
        <p className="hint">
          Open a memory and add its exact edition. Nothing is included automatically.
        </p>
      ) : (
        <ul className="list">
          {items.map((item) => (
            <ReadingEdition key={item.revisionId} item={item} onRemove={onRemove} />
          ))}
        </ul>
      )}
      <p className="hint">
        Reading-list membership grants no tools, workspace access, permissions or launch authority.
      </p>
    </section>
  );
}
