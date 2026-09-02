import { useEffect, useState, type FormEvent } from 'react';
import type {
  MemoryConfidence,
  MemoryDetailView,
  MemoryKind,
  MemoryPublishDisclosureView,
  MemorySearchResultView,
} from '@threadhelm/contracts';
import { api, call } from '../../api.js';
import { useStore } from '../../store.js';
import { MemoryDetail } from './MemoryDetail.js';
import { ModalDialog } from './ModalDialog.js';

const KIND_LABELS: Record<MemoryKind, string> = {
  fact: 'Fact',
  decision: 'Decision',
  constraint: 'Constraint',
  artifact: 'Artifact reference',
  lesson: 'Lesson',
};

export function MemoryList({
  initialQuery = '',
  expanded = false,
  onAddToReadingList,
}: {
  initialQuery?: string;
  expanded?: boolean;
  onAddToReadingList?(detail: MemoryDetailView): void;
} = {}) {
  const { state } = useStore();
  const [open, setOpen] = useState(expanded);
  const [workspaceId, setWorkspaceId] = useState('');
  const [query, setQuery] = useState(initialQuery);
  const [items, setItems] = useState<MemorySearchResultView[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [includeContested, setIncludeContested] = useState(false);
  const [detail, setDetail] = useState<MemoryDetailView | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [kind, setKind] = useState<MemoryKind>('fact');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [source, setSource] = useState('');
  const [confidence, setConfidence] = useState<MemoryConfidence>('unknown');
  const [memoryExpiresAt, setMemoryExpiresAt] = useState('');
  const [publishDisclosure, setPublishDisclosure] = useState<MemoryPublishDisclosureView | null>(
    null,
  );
  const [publishConfirmed, setPublishConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId || !state.workspaces.some((workspace) => workspace.id === workspaceId)) {
      setWorkspaceId(state.workspaces.find((workspace) => !workspace.revokedAt)?.id ?? '');
    }
  }, [state.workspaces, workspaceId]);

  const runSearch = async (cursor?: string, append = false) => {
    if (!workspaceId || !query.trim()) {
      setItems([]);
      setNextCursor(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await call(
        api.memory.search({
          scope: { workspaceId },
          query: query.trim(),
          ...(includeContested ? { includeContested: true } : {}),
          ...(cursor ? { cursor } : {}),
          limit: 20,
        }),
      );
      setItems((current) => (append ? [...current, ...result.items] : result.items));
      setNextCursor(result.nextCursor);
      if (detail && !result.items.some((item) => item.entryId === detail.summary.entryId)) {
        setDetail(null);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Shared-memory search failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded && initialQuery.trim() && workspaceId) void runSearch();
    // The workspace is resolved after the first render; a guided query runs once for that scope.
  }, [expanded, initialQuery, workspaceId]);

  useEffect(() => {
    if (open && query.trim()) void runSearch();
    if (detail) {
      void call(
        api.memory.get({
          entryId: detail.summary.entryId,
          scope: detail.summary.scope,
        }),
      )
        .then(setDetail)
        .catch(() => setDetail(null));
    }
    // A content-free event is only a reload signal. No event body enters renderer state.
  }, [state.memorySequence]);

  const search = (event: FormEvent) => {
    event.preventDefault();
    void runSearch();
  };

  const loadDetail = async (item: MemorySearchResultView) => {
    setError(null);
    try {
      setDetail(
        await call(
          api.memory.get({
            entryId: item.entryId,
            scope: item.scope,
          }),
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Memory detail failed to load.');
    }
  };

  const previewPublish = async () => {
    if (!workspaceId) return;
    setError(null);
    try {
      setPublishDisclosure(
        await call(
          api.memory.previewPublish({
            scope: { workspaceId },
            kind,
            title: title.trim() || null,
            body,
            sourceRefs: source.trim() ? [{ kind: 'artifact', id: source.trim() }] : [],
            confidence,
            memoryExpiresAt: memoryExpiresAt ? new Date(memoryExpiresAt).toISOString() : null,
          }),
        ),
      );
      setPublishConfirmed(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Memory publication preview failed.');
    }
  };

  const confirmPublish = async () => {
    if (!publishDisclosure || !publishConfirmed) return;
    try {
      const published = await call(
        api.memory.confirmPublish({
          publishToken: publishDisclosure.publishToken,
          durableContentConfirmation: true,
        }),
      );
      setPublishOpen(false);
      setPublishDisclosure(null);
      setPublishConfirmed(false);
      setTitle('');
      setBody('');
      setSource('');
      setMemoryExpiresAt('');
      setDetail(published);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Memory publication failed.');
    }
  };

  return (
    <section className="panel memory-panel">
      <div className="panel-heading">
        <h2>Hive memory</h2>
        <button
          type="button"
          className="small"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          Shared memory
        </button>
      </div>
      {!open ? (
        <p className="hint">Attributed workspace knowledge, published deliberately.</p>
      ) : null}
      {open ? (
        <div className="memory-surface" role="region" aria-label="Shared memory">
          <label className="field">
            Memory scope
            <select
              value={workspaceId}
              onChange={(event) => {
                setWorkspaceId(event.target.value);
                setItems([]);
                setNextCursor(null);
                setDetail(null);
              }}
            >
              {state.workspaces
                .filter((workspace) => !workspace.revokedAt)
                .map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.displayPath}
                  </option>
                ))}
            </select>
          </label>
          {workspaceId ? null : (
            <p className="hint">Approve a workspace before publishing or searching.</p>
          )}
          <div className="panel-heading">
            <form className="memory-search" role="search" onSubmit={search}>
              <label className="visually-hidden" htmlFor="memory-search-input">
                Search shared memory
              </label>
              <input
                id="memory-search-input"
                type="search"
                aria-label="Search shared memory"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setItems([]);
                  setNextCursor(null);
                }}
                disabled={!workspaceId}
              />
              <button type="submit" className="small" disabled={!workspaceId || !query.trim()}>
                Search
              </button>
            </form>
            <label className="confirmation compact">
              <input
                type="checkbox"
                checked={includeContested}
                onChange={(event) => {
                  setIncludeContested(event.target.checked);
                  setItems([]);
                  setNextCursor(null);
                  setDetail(null);
                }}
              />{' '}
              Include contested
            </label>
            <button
              type="button"
              className="small"
              disabled={!workspaceId || state.storageDegraded}
              onClick={() => setPublishOpen(true)}
            >
              Publish memory…
            </button>
          </div>

          {loading ? <p className="hint">Searching…</p> : null}
          {error ? (
            <p className="notice error" role="alert">
              {error}
            </p>
          ) : null}
          <ul className="list memory-results" aria-label="Shared memory results">
            {items.map((item) => (
              <li key={item.entryId}>
                <div className="panel-heading">
                  <strong>{item.title ?? 'Untitled memory'}</strong>
                  <span className={`badge memory-${item.status}`}>{item.status}</span>
                </div>
                <p className="memory-excerpt">{item.excerpt}</p>
                <p className="hint">
                  {KIND_LABELS[item.kind]} ·{' '}
                  {item.author.kind === 'user'
                    ? 'User'
                    : `Session ${item.author.sessionId.slice(0, 8)}`}
                </p>
                <button type="button" className="small" onClick={() => void loadDetail(item)}>
                  View details
                </button>
              </li>
            ))}
          </ul>
          {nextCursor ? (
            <button
              type="button"
              className="small"
              disabled={loading}
              onClick={() => void runSearch(nextCursor, true)}
            >
              Load more memories
            </button>
          ) : null}
          {detail ? (
            <>
              <MemoryDetail detail={detail} onChanged={setDetail} />
              {onAddToReadingList && detail.body !== null ? (
                <button
                  type="button"
                  className="small primary"
                  onClick={() => onAddToReadingList(detail)}
                >
                  Add exact edition to reading list
                </button>
              ) : null}
            </>
          ) : null}

          {publishOpen && !publishDisclosure ? (
            <ModalDialog label="Publish shared memory" onDismiss={() => setPublishOpen(false)}>
              <h3>Publish shared memory</h3>
              <label className="field">
                Kind
                <select
                  value={kind}
                  onChange={(event) => setKind(event.target.value as MemoryKind)}
                >
                  {Object.entries(KIND_LABELS).map(([value, text]) => (
                    <option key={value} value={value}>
                      {text}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Title
                <input
                  value={title}
                  maxLength={160}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <label className="field">
                Body
                <textarea rows={7} value={body} onChange={(event) => setBody(event.target.value)} />
              </label>
              <label className="field">
                Source reference
                <input
                  value={source}
                  maxLength={512}
                  onChange={(event) => setSource(event.target.value)}
                />
              </label>
              <label className="field">
                Confidence
                <select
                  value={confidence}
                  onChange={(event) => setConfidence(event.target.value as MemoryConfidence)}
                >
                  <option value="unknown">Unknown</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label className="field">
                Expires at (optional)
                <input
                  type="datetime-local"
                  value={memoryExpiresAt}
                  onChange={(event) => setMemoryExpiresAt(event.target.value)}
                />
              </label>
              <div className="actions">
                <button type="button" onClick={() => setPublishOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary"
                  disabled={!body.trim()}
                  onClick={() => void previewPublish()}
                >
                  Review publication
                </button>
              </div>
            </ModalDialog>
          ) : null}

          {publishDisclosure ? (
            <ModalDialog
              label="Review durable memory publication"
              onDismiss={() => setPublishDisclosure(null)}
            >
              <h3>Review durable memory publication</h3>
              <p>{publishDisclosure.safeSummary}</p>
              <pre className="memory-body">{publishDisclosure.body}</pre>
              <p className="hint">
                This context does not grant authority for tools, scope, credentials, spending, or
                external actions.
              </p>
              {publishDisclosure.memoryExpiresAt ? (
                <p>Expires {new Date(publishDisclosure.memoryExpiresAt).toLocaleString()}</p>
              ) : null}
              <label className="confirmation">
                <input
                  type="checkbox"
                  checked={publishConfirmed}
                  onChange={(event) => setPublishConfirmed(event.target.checked)}
                />{' '}
                Persist this exact content and attribution.
              </label>
              <div className="actions">
                <button type="button" onClick={() => setPublishDisclosure(null)}>
                  Back
                </button>
                <button
                  type="button"
                  className="primary"
                  disabled={!publishConfirmed}
                  onClick={() => void confirmPublish()}
                >
                  Publish memory
                </button>
              </div>
            </ModalDialog>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
