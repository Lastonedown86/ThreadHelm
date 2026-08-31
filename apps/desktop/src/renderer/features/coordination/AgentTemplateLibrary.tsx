import { useEffect, useState } from 'react';
import type { OperationResponse } from '@threadhelm/contracts';
import { api, call } from '../../api.js';
import { useStore } from '../../store.js';
import { AgentAuthoringError } from './AgentAuthoringError.js';
import { LazyAgentProfileWizard } from './LazyAgentProfileWizard.js';
import { templateLabel } from './template-label.js';
import { ModalDialog } from './ModalDialog.js';

type Template = OperationResponse<'agentTemplates.list'>['templates'][number];
type Draft = OperationResponse<'agentWizard.listDrafts'>['drafts'][number];
type Detail = OperationResponse<'agentTemplates.get'>;
type Dialog =
  | { kind: 'wizard'; draftId?: string; sourceRevisionId?: string }
  | { kind: 'duplicate'; template: Template }
  | {
      kind: 'delete';
      template: Template;
      preview: OperationResponse<'agentTemplates.previewDelete'>;
    }
  | null;

export function AgentTemplateLibrary() {
  const { state, actions } = useStore();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [duplicateName, setDuplicateName] = useState('');
  const [duplicateKey, setDuplicateKey] = useState('');

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      call(api.agentTemplates.list({ limit: 20 })),
      call(api.agentWizard.listDrafts({ limit: 20 })),
    ])
      .then(([library, saved]) => {
        if (cancelled) return;
        setTemplates(library.templates);
        setNextCursor(library.nextCursor);
        setDrafts(saved.drafts);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause);
      });
    return () => {
      cancelled = true;
    };
  }, [state.agentAuthoringSequence, refresh]);

  async function act(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }
  const changed = () => {
    setDetail(null);
    setRefresh((value) => value + 1);
  };

  return (
    <section className="panel agent-template-library" aria-labelledby="templates-heading">
      <div className="panel-heading">
        <h2 id="templates-heading">Agent templates</h2>
        <button
          type="button"
          className="small"
          disabled={busy || state.storageDegraded}
          onClick={() => setDialog({ kind: 'wizard' })}
        >
          Create agent…
        </button>
      </div>
      <p className="hint">
        Generic starters and your local scaffolds. Nothing here launches an agent.
      </p>
      <AgentAuthoringError error={error} />
      {drafts.length ? (
        <>
          <h3>Saved drafts</h3>
          <ul className="list" aria-label="Saved agent drafts">
            {drafts.map((draft) => (
              <li key={draft.draftId}>
                <span className="hint">
                  {draft.currentStep} · {draft.state}
                </span>{' '}
                <button
                  type="button"
                  className="small"
                  disabled={busy || state.storageDegraded}
                  onClick={() => setDialog({ kind: 'wizard', draftId: draft.draftId })}
                >
                  Resume draft {draft.draftId.slice(0, 8)}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <ul className="list" aria-label="Agent templates">
        {templates.map((template) => (
          <li key={template.templateId}>
            <strong>{templateLabel(template)}</strong>{' '}
            <span className="badge">revision {template.revision}</span>{' '}
            {template.state !== 'active' ? <span className="badge">{template.state}</span> : null}
            <div className="actions inline">
              <button
                type="button"
                className="small"
                disabled={busy}
                onClick={() =>
                  void act(async () =>
                    setDetail(
                      await call(api.agentTemplates.get({ templateId: template.templateId })),
                    ),
                  )
                }
              >
                Details
              </button>
              <button
                type="button"
                className="small"
                disabled={busy || state.storageDegraded || template.state !== 'active'}
                onClick={() =>
                  setDialog({ kind: 'wizard', sourceRevisionId: template.currentRevisionId })
                }
              >
                Use template
              </button>
              <button
                type="button"
                className="small"
                disabled={busy || state.storageDegraded || template.state !== 'active'}
                onClick={() => {
                  setDuplicateName(`${template.name} copy`);
                  setDuplicateKey(`${template.key}-copy`);
                  setDialog({ kind: 'duplicate', template });
                }}
              >
                Duplicate
              </button>
              {template.origin === 'user' ? (
                <>
                  <button
                    type="button"
                    className="small"
                    disabled={busy || state.storageDegraded}
                    onClick={() =>
                      void act(async () => {
                        await call(
                          api.agentTemplates.setEnabled({
                            templateId: template.templateId,
                            revisionId: template.currentRevisionId,
                            enabled: template.state !== 'active',
                          }),
                        );
                        changed();
                      })
                    }
                  >
                    {template.state === 'active' ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    className="small"
                    disabled={busy || state.storageDegraded}
                    onClick={() =>
                      void act(async () => {
                        const preview = await call(
                          api.agentTemplates.previewDelete({
                            templateId: template.templateId,
                            revisionId: template.currentRevisionId,
                          }),
                        );
                        setDialog({ kind: 'delete', template, preview });
                      })
                    }
                  >
                    Delete
                  </button>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {nextCursor ? (
        <button
          type="button"
          className="small"
          disabled={busy}
          onClick={() =>
            void act(async () => {
              const next = await call(api.agentTemplates.list({ limit: 20, cursor: nextCursor }));
              setTemplates((previous) => [
                ...previous,
                ...next.templates.filter(
                  (item) => !previous.some((old) => old.templateId === item.templateId),
                ),
              ]);
              setNextCursor(next.nextCursor);
            })
          }
        >
          Load more templates
        </button>
      ) : null}
      {detail ? (
        <section className="memory-detail" aria-label="Template detail">
          <h3>{detail.name}</h3>
          <p className="hint">
            {detail.origin} · revision {detail.revision} ·{' '}
            <span className="mono">{detail.currentRevisionId}</span>
          </p>
          {detail.provenance.sourceProfileRevisionId ? (
            <p className="hint">
              From reviewed profile revision{' '}
              <span className="mono">{detail.provenance.sourceProfileRevisionId}</span>.
            </p>
          ) : null}
          <p className="hint">
            SHA-256: <span className="mono">{detail.digest}</span>
          </p>
          <p>
            Template content is inert. Only the separate launch policy can resolve effective
            settings.
          </p>
          <pre className="wizard-json" tabIndex={0} aria-label="Template manifest JSON">
            {detail.manifestJson}
          </pre>
          <p className="hint">
            Declared variables:{' '}
            {detail.variables.map((variable) => variable.name).join(', ') || 'None'}
          </p>
          <button type="button" className="small" onClick={() => setDetail(null)}>
            Close template detail
          </button>
        </section>
      ) : null}
      {dialog?.kind === 'wizard' ? (
        <LazyAgentProfileWizard
          {...(dialog.draftId ? { draftId: dialog.draftId } : {})}
          {...(dialog.sourceRevisionId ? { sourceRevisionId: dialog.sourceRevisionId } : {})}
          onClose={() => {
            setDialog(null);
            changed();
          }}
          onCompleted={(message) => {
            setDialog(null);
            changed();
            actions.setNotice(message);
          }}
        />
      ) : null}
      {dialog?.kind === 'duplicate' ? (
        <ModalDialog
          label="Duplicate template"
          onDismiss={() => {
            if (!busy) setDialog(null);
          }}
        >
          <h3>Duplicate template</h3>
          <p>
            Copy {dialog.template.name} to a separate local template. The original stays unchanged.
          </p>
          <AgentAuthoringError error={error} />
          <label className="field">
            Template name
            <input
              disabled={busy}
              value={duplicateName}
              maxLength={200}
              onChange={(event) => setDuplicateName(event.target.value)}
            />
          </label>
          <label className="field">
            Template key
            <input
              disabled={busy}
              value={duplicateKey}
              maxLength={128}
              onChange={(event) => setDuplicateKey(event.target.value)}
            />
          </label>
          <div className="actions">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await call(
                    api.agentTemplates.duplicate({
                      templateRevisionId: dialog.template.currentRevisionId,
                      key: duplicateKey,
                      name: duplicateName,
                    }),
                  );
                  setDialog(null);
                  changed();
                })
              }
            >
              Confirm duplicate
            </button>
            <button type="button" disabled={busy} onClick={() => setDialog(null)}>
              Cancel
            </button>
          </div>
        </ModalDialog>
      ) : null}
      {dialog?.kind === 'delete' ? (
        <ModalDialog
          label="Delete local template"
          onDismiss={() => {
            if (!busy) setDialog(null);
          }}
        >
          <h3>Delete local template</h3>
          <p>
            Delete {dialog.template.name} and its retained template content? Open drafts must be
            deleted or completed first. This cannot be undone.
          </p>
          <AgentAuthoringError error={error} />
          <div className="actions">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await call(
                    api.agentTemplates.delete({
                      deleteToken: dialog.preview.deleteToken,
                      deleteConfirmation: true,
                    }),
                  );
                  setDialog(null);
                  changed();
                })
              }
            >
              Confirm delete template
            </button>
            <button type="button" disabled={busy} onClick={() => setDialog(null)}>
              Keep template
            </button>
          </div>
        </ModalDialog>
      ) : null}
    </section>
  );
}
