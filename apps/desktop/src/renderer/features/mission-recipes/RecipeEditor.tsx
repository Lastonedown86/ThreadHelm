import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MissionRecipeContent as ContentSchema,
  MissionRecipeEditorContent as BufferSchema,
} from '@threadhelm/contracts';
import type {
  MissionRecipeContent,
  MissionRecipeEditor,
  MissionRecipeReceipt,
} from '@threadhelm/contracts';
import { api, call } from '../../api.js';
import { ModalDialog } from '../coordination/ModalDialog.js';
import { recipeError } from './RecipePreview.js';
import { useRecipeEditor } from './useRecipeEditor.js';

export function RecipeEditor({
  initial,
  onSaved,
  onClose,
  onFlushReady,
  onOpen,
}: {
  initial: MissionRecipeEditor;
  onSaved(receipt: MissionRecipeReceipt): void;
  onClose(): void;
  onFlushReady(flush: (() => Promise<boolean>) | null): void;
  onOpen(editor: MissionRecipeEditor): void;
}) {
  const draft = useRecipeEditor(initial);
  const [preview, setPreview] = useState<{
    previewId: string;
    content: MissionRecipeContent;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [discarding, setDiscarding] = useState(false);
  const [reviewAttempted, setReviewAttempted] = useState(false);
  const validity = (reviewAttempted ? ContentSchema : BufferSchema).safeParse(draft.content);
  const invalidFields = new Set(
    validity.success ? [] : validity.error.issues.map((issue) => issue.path.join('.')),
  );
  const fieldProps = (path: string) => ({
    'data-recipe-field': path,
    'aria-invalid': invalidFields.has(path),
    'aria-describedby': invalidFields.has(path) ? 'recipe-editor-errors' : undefined,
  });
  const request = useRef<{ previewId: string; requestId: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (preview) heading.current?.focus();
  }, [preview]);
  const flush = useCallback(async () => (await draft.flush()) !== null, [draft.flush]);
  useEffect(() => {
    onFlushReady(flush);
    return () => onFlushReady(null);
  }, [flush, onFlushReady]);
  const update = (patch: Partial<MissionRecipeContent>) => {
    draft.update({ ...draft.content, ...patch });
    setPreview(null);
    request.current = null;
  };
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (c) {
      setError(recipeError(c));
    } finally {
      setBusy(false);
    }
  };
  const list = (field: 'acceptanceChecklist' | 'suggestedRoles', label: string, cap: number) => (
    <fieldset disabled={busy}>
      <legend>{label}</legend>
      {draft.content[field].map((text, i) => (
        <div key={i}>
          <label className="field">
            {label} {i + 1}
            <textarea
              {...fieldProps(`${field}.${i}`)}
              value={text}
              onChange={(e) =>
                update({
                  [field]: draft.content[field].map((v, j) => (j === i ? e.target.value : v)),
                })
              }
            />
            <span>{text.length}/1,000 characters</span>
          </label>
          <button
            type="button"
            onClick={() => update({ [field]: draft.content[field].filter((_, j) => j !== i) })}
          >
            Remove {label.toLowerCase()} {i + 1}
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={draft.content[field].length >= cap}
        onClick={() => update({ [field]: [...draft.content[field], ''] })}
      >
        Add {label.toLowerCase()}
      </button>
    </fieldset>
  );
  return (
    <section aria-label="Personal recipe editor">
      <h2>Personal recipe editor</h2>
      <p>
        Only reviewed text is saved. Existing drafts retain their original content and provenance.
      </p>
      <p role="status">{draft.status}</p>
      <fieldset disabled={busy}>
        <legend>Recipe content</legend>
        <label className="field">
          Recipe name
          <input
            {...fieldProps('name')}
            value={draft.content.name}
            onChange={(e) => update({ name: e.target.value })}
          />
          <span>{draft.content.name.length}/120 characters</span>
        </label>
        <label className="field">
          Description
          <textarea
            {...fieldProps('description')}
            value={draft.content.description}
            onChange={(e) => update({ description: e.target.value })}
          />
          <span>{draft.content.description.length}/1,000 characters</span>
        </label>
        <label className="field">
          Outcome scaffold
          <textarea
            {...fieldProps('outcomeScaffold')}
            value={draft.content.outcomeScaffold}
            onChange={(e) => update({ outcomeScaffold: e.target.value })}
          />
          <span>
            {draft.content.outcomeScaffold.length}/8,000 characters; each resulting draft must also
            fit the composer.
          </span>
        </label>
      </fieldset>
      {list('acceptanceChecklist', 'Checklist item', 30)}
      {list('suggestedRoles', 'Role suggestion', 12)}
      <fieldset disabled={busy}>
        <legend>Literal variables</legend>
        <p>
          Use {'{{key}}'} in content. Values are literal text, never commands. Escape an opening
          token with a backslash.
        </p>
        {draft.content.variables.map((variable, i) => (
          <div key={i}>
            <label className="field">
              Variable key {i + 1}
              <input
                {...fieldProps(`variables.${i}.key`)}
                value={variable.key}
                onChange={(e) =>
                  update({
                    variables: draft.content.variables.map((v, j) =>
                      j === i ? { ...v, key: e.target.value } : v,
                    ),
                  })
                }
              />
            </label>
            <label className="field">
              Variable label {i + 1}
              <input
                {...fieldProps(`variables.${i}.label`)}
                value={variable.label}
                onChange={(e) =>
                  update({
                    variables: draft.content.variables.map((v, j) =>
                      j === i ? { ...v, label: e.target.value } : v,
                    ),
                  })
                }
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={variable.required}
                onChange={(e) =>
                  update({
                    variables: draft.content.variables.map((v, j) =>
                      j === i ? { ...v, required: e.target.checked } : v,
                    ),
                  })
                }
              />
              Required variable {i + 1}
            </label>
            <button
              type="button"
              onClick={() =>
                update({ variables: draft.content.variables.filter((_, j) => j !== i) })
              }
            >
              Remove variable {i + 1}
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={draft.content.variables.length >= 20}
          onClick={() =>
            update({
              variables: [...draft.content.variables, { key: '', label: '', required: false }],
            })
          }
        >
          Add variable
        </button>
      </fieldset>
      {draft.error || error ? <p role="alert">{error || draft.error}</p> : null}
      {invalidFields.size ? (
        <p id="recipe-editor-errors" role="alert">
          Check these fields for required text, limits or invalid content:{' '}
          {[...invalidFields].join(', ')}. Current text is retained.
        </p>
      ) : null}
      <div className="mission-action-row">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              setReviewAttempted(true);
              const checked = ContentSchema.safeParse(draft.content);
              if (!checked.success) {
                const first = checked.error.issues[0]?.path.join('.');
                requestAnimationFrame(() =>
                  document.querySelector<HTMLElement>(`[data-recipe-field="${first}"]`)?.focus(),
                );
                return;
              }
              const saved = await draft.flush();
              if (!saved) return;
              setPreview(
                await call(
                  api.missionRecipes.previewSave({
                    editorId: saved.editorId,
                    expectedVersion: saved.version,
                  }),
                ),
              );
              request.current = null;
            })
          }
        >
          Preview saved recipe
        </button>
        <button type="button" disabled={busy} onClick={() => void draft.flush()}>
          Retry local save
        </button>
        {draft.error || error ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await draft.flush();
                  draft.replace(
                    await call(api.missionRecipes.getEditor({ editorId: draft.editor.editorId })),
                  );
                  setPreview(null);
                  request.current = null;
                })
              }
            >
              Reload saved editor and replace my edits
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const parsed = BufferSchema.safeParse(draft.content);
                  if (!parsed.success) {
                    setError('Correct invalid content before copying this editor.');
                    return;
                  }
                  await draft.flush();
                  const fresh = await call(api.missionRecipes.openEditor(undefined));
                  const saved = await call(
                    api.missionRecipes.saveEditor({
                      editorId: fresh.editorId,
                      expectedVersion: fresh.version,
                      content: parsed.data,
                    }),
                  );
                  onOpen(saved);
                })
              }
            >
              Copy my edits to a new editor
            </button>
          </>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              if (await flush()) onClose();
            })
          }
        >
          Back to recipes
        </button>
        <button type="button" disabled={busy} onClick={() => setDiscarding(true)}>
          Discard editor
        </button>
        {draft.editor.source || draft.editor.base ? (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const saved = await draft.flush();
                if (!saved) return;
                draft.replace(
                  await call(
                    api.missionRecipes.detachSource({
                      editorId: saved.editorId,
                      expectedVersion: saved.version,
                    }),
                  ),
                );
                setPreview(null);
                request.current = null;
              })
            }
          >
            Keep as separate personal copy
          </button>
        ) : null}
      </div>
      {preview ? (
        <section aria-label="Saved recipe preview">
          <h3 tabIndex={-1} ref={heading}>
            Saved recipe preview
          </h3>
          <h4>{preview.content.name}</h4>
          <p className="recipe-text">{preview.content.description}</p>
          <p className="recipe-text">{preview.content.outcomeScaffold}</p>
          <ul>
            {preview.content.acceptanceChecklist.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
          <ul>
            {preview.content.suggestedRoles.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
          <ul>
            {preview.content.variables.map((v) => (
              <li key={v.key}>
                {v.key}: {v.label} ({v.required ? 'required' : 'optional'})
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                request.current ??= {
                  previewId: preview.previewId,
                  requestId: crypto.randomUUID(),
                };
                onSaved(await call(api.missionRecipes.save(request.current)));
              })
            }
          >
            Save personal recipe
          </button>
        </section>
      ) : null}
      {discarding ? (
        <ModalDialog
          label="Discard recipe editor"
          onDismiss={() => {
            if (!busy) setDiscarding(false);
          }}
        >
          <h2>Discard this authoring buffer?</h2>
          <p>
            Its saved buffer and unsaved edits will be removed. Existing recipes and drafts remain.
          </p>
          <button type="button" disabled={busy} onClick={() => setDiscarding(false)}>
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await draft.flush();
                await call(
                  api.missionRecipes.discardEditor({
                    editorId: draft.editor.editorId,
                    expectedVersion: draft.version(),
                  }),
                );
                onClose();
              })
            }
          >
            Discard permanently
          </button>
          {error ? <p role="alert">{error}</p> : null}
        </ModalDialog>
      ) : null}
    </section>
  );
}
