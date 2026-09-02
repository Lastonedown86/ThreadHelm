import type { MemoryDetailView } from '@threadhelm/contracts';

export function MissionReadingList({
  items,
  onRemove,
}: {
  items: MemoryDetailView[];
  onRemove(revisionId: string): void;
}) {
  const bytes = items.reduce(
    (total, item) => total + new TextEncoder().encode(item.body ?? '').byteLength,
    0,
  );
  return (
    <section className="mission-reading-list" aria-labelledby="reading-list-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Mission context packet</p>
          <h2 id="reading-list-heading">Reading list</h2>
        </div>
        <strong>{bytes.toLocaleString()} bytes</strong>
      </div>
      {items.length === 0 ? (
        <p className="hint">
          Open a volume and add its exact edition. Nothing is included automatically.
        </p>
      ) : (
        <ul className="list">
          {items.map((item) => (
            <li key={item.summary.revisionId}>
              <strong>{item.summary.title ?? 'Untitled volume'}</strong>{' '}
              <span className={`badge memory-${item.summary.status}`}>{item.summary.status}</span>
              <div className="mono small-text">edition {item.summary.revisionId}</div>
              {item.summary.status !== 'active' ? (
                <p className="notice warning">Review this lifecycle state before mission use.</p>
              ) : null}
              <button
                type="button"
                className="small"
                onClick={() => onRemove(item.summary.revisionId)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="hint">
        Reading-list membership supplies evidence only. It grants no tools, workspace, permission,
        or launch authority.
      </p>
    </section>
  );
}
