import { useEffect, useRef, useState } from 'react';
import type {
  MissionRecipeDetail,
  MissionRecipeSummary,
  MissionRecipeEditor,
} from '@threadhelm/contracts';
import { api, call } from '../../api.js';
import { RecipePreview, recipeError } from './RecipePreview.js';
import { RecipeEditor } from './RecipeEditor.js';
import { RecipeDeleteDialog } from './RecipeDeleteDialog.js';
import { RecipeSourceSelection, type RecipeSource } from './RecipeSourceSelection.js';

export function MissionRecipeLibrary({
  onClose,
  onCreated,
  source,
  onFlushReady,
}: {
  onClose(): void;
  onCreated(id: string): void;
  source?: RecipeSource;
  onFlushReady(flush: (() => Promise<boolean>) | null): void;
}) {
  const [editor, setEditor] = useState<MissionRecipeEditor | null>(null);
  const [selectingSource, setSelectingSource] = useState(!!source);
  const [editors, setEditors] = useState<{ editorId: string; name: string; updatedAt: string }[]>(
    [],
  );
  const [editorCursor, setEditorCursor] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState('');
  const [items, setItems] = useState<MissionRecipeSummary[]>([]);
  const [selected, setSelected] = useState<MissionRecipeDetail | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [origin, setOrigin] = useState<'' | 'bundled' | 'personal'>('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const sequence = useRef(0);
  const detailSequence = useRef(0);
  const pending = useRef(false);
  const loadEditors = async (nextCursor: string | null = null) => {
    try {
      const page = await call(api.missionRecipes.listEditors({ cursor: nextCursor }));
      setEditors(page.items);
      setEditorCursor(page.nextCursor);
    } catch (cause) {
      setError(recipeError(cause));
    }
  };
  useEffect(() => {
    void loadEditors();
  }, [editor]);
  const mutate = async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      setError(recipeError(cause));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const load = async (nextCursor: string | null = null) => {
    const ticket = ++sequence.current;
    setBusy(true);
    setError('');
    try {
      const page = await call(
        api.missionRecipes.list({ cursor: nextCursor, ...(origin ? { origin } : {}) }),
      );
      if (ticket === sequence.current) {
        setItems(page.items);
        setCursor(page.nextCursor);
      }
    } catch (cause) {
      if (ticket === sequence.current) setError(recipeError(cause));
    } finally {
      if (ticket === sequence.current) setBusy(false);
    }
  };
  useEffect(() => {
    setSelected(null);
    detailSequence.current++;
    void load();
    return () => {
      sequence.current++;
      detailSequence.current++;
    };
  }, [origin]);
  const select = async (id: string, refresh = false) => {
    const ticket = ++detailSequence.current;
    setError('');
    if (!refresh) setSelected(null);
    try {
      const detail = await call(api.missionRecipes.get({ recipeId: id }));
      if (ticket === detailSequence.current) setSelected(detail);
    } catch (cause) {
      if (ticket === detailSequence.current) setError(recipeError(cause));
    }
  };
  return (
    <section className="composer recipe-workspace" aria-labelledby="recipes-heading">
      <div className="mission-action-row">
        <h1 id="recipes-heading" tabIndex={-1}>
          Mission recipes
        </h1>
        <button type="button" onClick={onClose}>
          Close recipes
        </button>
      </div>
      {notice ? <p role="status">{notice}</p> : null}
      {editor ? (
        <RecipeEditor
          key={editor.editorId}
          initial={editor}
          onOpen={setEditor}
          onFlushReady={onFlushReady}
          onClose={() => {
            setEditor(null);
            setSelectingSource(false);
          }}
          onSaved={(receipt) => {
            setEditor(null);
            setSelectingSource(false);
            setNotice(
              `Saved recipe ${receipt.targetId} · version ${receipt.version} · ${receipt.savedAt}`,
            );
            void load();
            void select(receipt.targetId);
          }}
        />
      ) : selectingSource && source ? (
        <>
          <RecipeSourceSelection source={source} onOpen={setEditor} />
          <button type="button" onClick={() => setSelectingSource(false)}>
            Cancel selection
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void mutate(async () =>
                setEditor(await call(api.missionRecipes.openEditor(undefined))),
              )
            }
          >
            New personal recipe
          </button>
          {editors.length ? (
            <details>
              <summary>Resume recipe editors</summary>
              <ul>
                {editors.map((item) => (
                  <li key={item.editorId}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void mutate(async () =>
                          setEditor(
                            await call(api.missionRecipes.getEditor({ editorId: item.editorId })),
                          ),
                        )
                      }
                    >
                      {item.name || 'Untitled recipe'} · {item.editorId.slice(-8)}
                    </button>{' '}
                    · saved {item.updatedAt}
                  </li>
                ))}
              </ul>
              {editorCursor ? (
                <button type="button" onClick={() => void loadEditors(editorCursor)}>
                  More editors
                </button>
              ) : null}
            </details>
          ) : null}
          <label className="field">
            Recipe origin
            <select value={origin} onChange={(e) => setOrigin(e.target.value as typeof origin)}>
              <option value="">All recipes</option>
              <option value="bundled">Bundled</option>
              <option value="personal">Personal</option>
            </select>
          </label>
          {error ? (
            <p role="alert">
              {error}{' '}
              <button type="button" onClick={() => void load()}>
                Retry list
              </button>
            </p>
          ) : null}
          <div className="recipe-layout">
            <div>
              <ul className="recipe-list" aria-label="Recipes">
                {items.map((item) => (
                  <li key={item.recipeId}>
                    <button
                      type="button"
                      aria-pressed={selected?.recipeId === item.recipeId}
                      disabled={busy}
                      onClick={() => void select(item.recipeId)}
                    >
                      {item.name}
                    </button>
                    <p>{item.description}</p>
                    <small>
                      {item.origin} · revision {item.ordinal} · {item.recipeId.slice(-8)} ·{' '}
                      {item.availability}
                    </small>
                  </li>
                ))}
              </ul>
              {!busy && !items.length ? <p>No recipes in this view.</p> : null}
              {cursor ? (
                <button type="button" disabled={busy} onClick={() => void load(cursor)}>
                  Load more recipes
                </button>
              ) : null}
              <button type="button" disabled={busy} onClick={() => void load()}>
                Refresh list
              </button>
            </div>
            {selected ? (
              <div>
                <RecipePreview
                  key={selected.recipeId}
                  recipe={selected}
                  onRefresh={() => select(selected.recipeId, true)}
                  onCreated={onCreated}
                />
                <div className="mission-action-row">
                  <button
                    type="button"
                    disabled={busy || !selected.content}
                    onClick={() =>
                      void mutate(async () =>
                        setEditor(
                          await call(
                            api.missionRecipes.duplicate({
                              recipeId: selected.recipeId,
                              revisionId: selected.revisionId,
                              expectedVersion: selected.version,
                            }),
                          ),
                        ),
                      )
                    }
                  >
                    {selected.origin === 'bundled' ? 'Customize as personal copy' : 'Duplicate'}
                  </button>
                  {selected.origin === 'personal' ? (
                    <>
                      <button
                        type="button"
                        disabled={busy || !selected.content}
                        onClick={() =>
                          void mutate(async () =>
                            setEditor(
                              await call(
                                api.missionRecipes.edit({
                                  recipeId: selected.recipeId,
                                  revisionId: selected.revisionId,
                                  expectedVersion: selected.version,
                                }),
                              ),
                            ),
                          )
                        }
                      >
                        Edit recipe
                      </button>
                      <button
                        type="button"
                        disabled={busy || selected.availability === 'unsupported'}
                        onClick={() =>
                          void mutate(async () => {
                            await call(
                              api.missionRecipes.setEnabled({
                                recipeId: selected.recipeId,
                                expectedVersion: selected.version,
                                enabled: selected.availability === 'disabled',
                                requestId: crypto.randomUUID(),
                              }),
                            );
                            await select(selected.recipeId, true);
                            await load();
                          })
                        }
                      >
                        {selected.availability === 'disabled' ? 'Enable recipe' : 'Disable recipe'}
                      </button>
                      <button type="button" disabled={busy} onClick={() => setDeleting(true)}>
                        Delete personal recipe
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            ) : (
              <p>Select a recipe to review its inputs and draft content.</p>
            )}
          </div>
        </>
      )}
      {deleting && selected ? (
        <RecipeDeleteDialog
          recipe={selected}
          onClose={() => setDeleting(false)}
          onDeleted={() => {
            setDeleting(false);
            setSelected(null);
            void load();
            void loadEditors();
            requestAnimationFrame(() => document.getElementById('recipes-heading')?.focus());
          }}
        />
      ) : null}
    </section>
  );
}
