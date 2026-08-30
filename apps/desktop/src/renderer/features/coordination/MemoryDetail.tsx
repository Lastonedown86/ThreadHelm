import { useEffect, useState } from 'react';
import type {
  MemoryDeletionDisclosureView,
  MemoryDetailView,
  MemorySupersedeDisclosureView,
} from '@threadhelm/contracts';
import { api, call } from '../../api.js';
import { ModalDialog } from './ModalDialog.js';

function label(value: string): string {
  return value.replaceAll('_', ' ').replace(/^./u, (first) => first.toUpperCase());
}

export function MemoryDetail({
  detail,
  onChanged,
}: {
  detail: MemoryDetailView;
  onChanged(detail: MemoryDetailView): void;
}) {
  const [retractOpen, setRetractOpen] = useState(false);
  const [retractReason, setRetractReason] = useState('');
  const [deleteDisclosure, setDeleteDisclosure] = useState<MemoryDeletionDisclosureView | null>(
    null,
  );
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [supersedeOpen, setSupersedeOpen] = useState(false);
  const [supersedeTitle, setSupersedeTitle] = useState(detail.summary.title ?? '');
  const [supersedeBody, setSupersedeBody] = useState(detail.body ?? '');
  const [supersedeDisclosure, setSupersedeDisclosure] =
    useState<MemorySupersedeDisclosureView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupersedeTitle(detail.summary.title ?? '');
    setSupersedeBody(detail.body ?? '');
    setSupersedeDisclosure(null);
  }, [detail.summary.revisionId, detail.summary.title, detail.body]);

  const retract = async () => {
    try {
      const next = await call(
        api.memory.retract({
          entryId: detail.summary.entryId,
          revisionId: detail.summary.revisionId,
          reasonCode: retractReason,
        }),
      );
      setRetractOpen(false);
      setRetractReason('');
      onChanged(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Memory retraction failed.');
    }
  };

  const requestDeletion = async () => {
    try {
      setDeleteDisclosure(
        await call(api.memory.requestDeletion({ entryId: detail.summary.entryId })),
      );
      setDeleteConfirmed(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Deletion preview failed.');
    }
  };

  const confirmDeletion = async () => {
    if (!deleteDisclosure || !deleteConfirmed) return;
    try {
      const next = await call(
        api.memory.confirmDeletion({
          deletionToken: deleteDisclosure.deletionToken,
          permanentDeletionConfirmation: true,
        }),
      );
      setDeleteDisclosure(null);
      onChanged(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Memory deletion failed.');
    }
  };

  const previewSupersede = async () => {
    try {
      const citedMemoryIds = new Set<string>([detail.summary.entryId]);
      for (const conflict of detail.conflicts) {
        if (conflict.state !== 'open') continue;
        citedMemoryIds.add(conflict.leftEntryId);
        citedMemoryIds.add(conflict.rightEntryId);
      }
      const stableSources = detail.summary.sourceRefs.filter(
        (source) => source.kind !== 'memory' || !citedMemoryIds.has(source.id),
      );
      const preview = await call(
        api.memory.previewSupersede({
          entryId: detail.summary.entryId,
          targetRevisionId: detail.summary.revisionId,
          title: supersedeTitle || null,
          body: supersedeBody,
          sourceRefs: [
            ...[...citedMemoryIds].map((id) => ({ kind: 'memory' as const, id })),
            ...stableSources,
          ].slice(0, 32),
          confidence: detail.summary.confidence,
        }),
      );
      setSupersedeDisclosure(preview);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Supersede preview failed.');
    }
  };

  const confirmSupersede = async () => {
    if (!supersedeDisclosure) return;
    try {
      const next = await call(
        api.memory.confirmSupersede({ supersedeToken: supersedeDisclosure.supersedeToken }),
      );
      setSupersedeOpen(false);
      setSupersedeDisclosure(null);
      onChanged(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Supersede failed.');
    }
  };

  const resolve = async (conflictId: string) => {
    try {
      onChanged(
        await call(
          api.memory.resolveConflict({
            conflictId,
            resolutionRevisionId: detail.summary.revisionId,
          }),
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Conflict resolution failed.');
    }
  };

  return (
    <section className="memory-detail" aria-label="Memory detail">
      <div className="panel-heading">
        <h3>{detail.summary.title ?? 'Untitled memory'}</h3>
        <span className={`badge memory-${detail.summary.status}`}>
          {label(detail.summary.status)}
        </span>
      </div>
      <p className="hint">
        {label(detail.summary.kind)} · Confidence: {label(detail.summary.confidence)} · Revision{' '}
        {detail.lineage.find((revision) => revision.id === detail.summary.revisionId)?.revision ??
          1}
      </p>
      {detail.summary.expiredAt ? (
        <p className="hint">Expired {new Date(detail.summary.expiredAt).toLocaleString()}</p>
      ) : detail.summary.expiresAt ? (
        <p className="hint">Expires {new Date(detail.summary.expiresAt).toLocaleString()}</p>
      ) : null}
      {detail.body === null ? (
        <p className="notice">Content deleted. Content-free lifecycle evidence remains.</p>
      ) : (
        <pre className="memory-body">{detail.body}</pre>
      )}

      <h4>Citations</h4>
      {detail.summary.sourceRefs.length === 0 ? (
        <p className="hint">No cited source references.</p>
      ) : (
        <ul className="list memory-sources">
          {detail.summary.sourceRefs.map((source) => (
            <li key={`${source.kind}:${source.id}`}>
              <span className="badge">{label(source.kind)}</span>{' '}
              <span className="mono">{source.id}</span>
            </li>
          ))}
        </ul>
      )}

      <details>
        <summary>Revision lineage ({detail.lineage.length})</summary>
        <ol>
          {detail.lineage.map((revision) => (
            <li key={revision.id}>
              Revision {revision.revision}: {label(revision.status)} · {label(revision.confidence)}
            </li>
          ))}
        </ol>
      </details>

      {detail.conflicts.some((conflict) => conflict.state === 'open') ? (
        <div className="memory-conflicts">
          <h4>Open conflicts</h4>
          {detail.conflicts
            .filter((conflict) => conflict.state === 'open')
            .map((conflict) => {
              const currentCompetes =
                conflict.leftRevisionId === detail.summary.revisionId ||
                conflict.rightRevisionId === detail.summary.revisionId;
              return (
                <div key={conflict.id}>
                  <p role="status">Contested · {conflict.reasonCode}</p>
                  <button
                    type="button"
                    className="small"
                    disabled={currentCompetes}
                    onClick={() => void resolve(conflict.id)}
                  >
                    Resolve with current cited revision
                  </button>
                  {currentCompetes ? (
                    <p className="hint">Supersede with a cited resolution revision first.</p>
                  ) : null}
                </div>
              );
            })}
        </div>
      ) : null}

      {error ? (
        <p className="notice error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="actions inline">
        {detail.availableActions.includes('supersede') ? (
          <button type="button" className="small" onClick={() => setSupersedeOpen(true)}>
            Supersede…
          </button>
        ) : null}
        {detail.availableActions.includes('retract') ? (
          <button type="button" className="small" onClick={() => setRetractOpen(true)}>
            Retract…
          </button>
        ) : null}
        {detail.availableActions.includes('delete') ? (
          <button type="button" className="small danger" onClick={() => void requestDeletion()}>
            Delete content…
          </button>
        ) : null}
      </div>

      {retractOpen ? (
        <ModalDialog label="Retract memory revision" onDismiss={() => setRetractOpen(false)}>
          <h3>Retract memory revision</h3>
          <label className="field">
            Reason
            <input
              value={retractReason}
              onChange={(event) => setRetractReason(event.target.value)}
            />
          </label>
          <div className="actions">
            <button type="button" onClick={() => setRetractOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="danger"
              disabled={!retractReason.trim()}
              onClick={() => void retract()}
            >
              Retract revision
            </button>
          </div>
        </ModalDialog>
      ) : null}

      {deleteDisclosure ? (
        <ModalDialog
          label="Delete shared memory content"
          onDismiss={() => setDeleteDisclosure(null)}
        >
          <h3>Delete shared memory content</h3>
          <p>{deleteDisclosure.safeSummary}</p>
          <p>
            Title, body, citations, size, and search index data are removed; content-free lineage
            remains.
          </p>
          <label className="confirmation">
            <input
              type="checkbox"
              checked={deleteConfirmed}
              onChange={(event) => setDeleteConfirmed(event.target.checked)}
            />{' '}
            Permanently delete this content.
          </label>
          <div className="actions">
            <button type="button" onClick={() => setDeleteDisclosure(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="danger"
              disabled={!deleteConfirmed}
              onClick={() => void confirmDeletion()}
            >
              Delete permanently
            </button>
          </div>
        </ModalDialog>
      ) : null}

      {supersedeOpen ? (
        <ModalDialog label="Supersede shared memory" onDismiss={() => setSupersedeOpen(false)}>
          <h3>Supersede with a new revision</h3>
          <label className="field">
            Title
            <input
              value={supersedeTitle}
              onChange={(event) => setSupersedeTitle(event.target.value)}
            />
          </label>
          <label className="field">
            Body
            <textarea
              rows={6}
              value={supersedeBody}
              onChange={(event) => setSupersedeBody(event.target.value)}
            />
          </label>
          {supersedeDisclosure ? (
            <div className="notice">
              <p>{supersedeDisclosure.safeSummary}</p>
              <button type="button" className="primary" onClick={() => void confirmSupersede()}>
                Append revision
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="primary"
              disabled={!supersedeBody.trim()}
              onClick={() => void previewSupersede()}
            >
              Review supersession
            </button>
          )}
          <button type="button" onClick={() => setSupersedeOpen(false)}>
            Cancel
          </button>
        </ModalDialog>
      ) : null}
    </section>
  );
}
