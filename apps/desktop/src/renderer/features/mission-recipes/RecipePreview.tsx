import { useEffect, useRef, useState } from 'react';
import type { MissionRecipeDetail, MissionRecipePreview } from '@threadhelm/contracts';
import { reconcileRecipeValues } from '@threadhelm/domain';
import { api, call, RendererError } from '../../api.js';

export function recipeError(cause: unknown): string {
  const reason =
    cause instanceof RendererError ? String(cause.details.reason ?? cause.code) : 'SAVE_FAILED';
  const labels: Record<string, string> = {
    STALE_PREVIEW: 'This preview changed or expired. Refresh and review before continuing.',
    STALE_EDITOR: 'This editor was saved elsewhere. Reload it or keep a separate copy.',
    DISABLED: 'This recipe is disabled. Refresh the list to choose an available recipe.',
    DELETED: 'This item was deleted. Your current input remains here for review.',
    UNSUPPORTED_VERSION: 'This recipe uses an unsupported version and cannot be used.',
    MISSION_DRAFT_LIMIT:
      'You have 20 open drafts. Manage Drafts in the mission rail before creating another. Your recipe inputs remain here.',
    STORAGE_UNAVAILABLE: 'Local storage is unavailable. Your current input remains here.',
    INVALID_RECIPE: 'Check the content limits, declared variables and prohibited sensitive text.',
  };
  return (
    labels[reason] ?? 'The operation did not complete. Keep your input and retry after reviewing.'
  );
}

export function RecipePreview({
  recipe,
  onRefresh,
  onCreated,
}: {
  recipe: MissionRecipeDetail;
  onRefresh(): Promise<void>;
  onCreated(id: string): void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<MissionRecipePreview | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const sequence = useRef(0);
  const pending = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const request = useRef<{ previewId: string; requestId: string } | null>(null);
  const previousVariables = useRef(recipe.content?.variables ?? []);
  const [changes, setChanges] = useState('');
  useEffect(() => {
    if (preview) heading.current?.focus();
  }, [preview]);
  useEffect(() => {
    sequence.current++;
    setPreview(null);
    request.current = null;
    const reconciled = reconcileRecipeValues(
      previousVariables.current,
      recipe.content?.variables ?? [],
      values,
    );
    setValues(reconciled.values);
    if (reconciled.changed.length || reconciled.removed.length)
      setChanges(
        `Review updated variables. Changed: ${reconciled.changed.join(', ') || 'none'}. Removed: ${reconciled.removed.join(', ') || 'none'}. Compatible values were retained.`,
      );
    previousVariables.current = recipe.content?.variables ?? [];
    return () => {
      sequence.current++;
    };
  }, [recipe.revisionId, recipe.version]);
  const prepare = async () => {
    if (pending.current) return;
    const ticket = ++sequence.current;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const next = await call(
        api.missionRecipes.preview({
          recipeId: recipe.recipeId,
          revisionId: recipe.revisionId,
          expectedVersion: recipe.version,
          values,
        }),
      );
      if (ticket !== sequence.current) return;
      setPreview(next);
      request.current = null;
    } catch (cause) {
      if (ticket === sequence.current) setError(recipeError(cause));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const create = async () => {
    if (!preview?.previewId || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    request.current ??= { previewId: preview.previewId, requestId: crypto.randomUUID() };
    try {
      const saved = await call(api.missionRecipes.createDraft(request.current));
      onCreated(saved.targetId);
    } catch (cause) {
      setError(recipeError(cause));
      if (cause instanceof RendererError && cause.code === 'MISSION_DRAFT_LIMIT') {
        const inventory = document.querySelector<HTMLDetailsElement>('.mission-rail-drafts');
        if (inventory) {
          inventory.open = true;
          inventory.querySelector('summary')?.focus();
        }
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const issues = preview?.issues ?? [];
  const oversized = Object.values(values).some((v) => v.length > 2000);
  return (
    <section aria-label="Recipe details">
      <h2>{recipe.name}</h2>
      <p>{recipe.description}</p>
      <p>
        {recipe.origin} · revision {recipe.ordinal} ·{' '}
        <span title={recipe.recipeId}>{recipe.recipeId.slice(-8)}</span>
      </p>
      <p>Literal text only. Creating a draft does not start a mission or grant access.</p>
      {changes ? <p role="status">{changes}</p> : null}
      {recipe.availability !== 'enabled' ? (
        <p role="status">This recipe is {recipe.availability}. Creating a draft is unavailable.</p>
      ) : null}
      {recipe.content?.variables.map((variable) => (
        <label className="field" key={variable.key}>
          {variable.label} ({variable.required ? 'required' : 'optional'})
          <textarea
            value={values[variable.key] ?? ''}
            disabled={busy}
            aria-invalid={(values[variable.key]?.length ?? 0) > 2000}
            aria-describedby={`recipe-limit-${variable.key}`}
            onChange={(e) => {
              sequence.current++;
              setValues({ ...values, [variable.key]: e.target.value });
              setPreview(null);
              request.current = null;
            }}
          />
          <span id={`recipe-limit-${variable.key}`} className="hint">
            {values[variable.key]?.length ?? 0}/2,000 characters
          </span>
        </label>
      ))}
      <p className="hint">
        Some symbols count as two characters. The composer accepts 4,000 characters and UTF-8 bytes
        for the outcome, and 2,000 for the entire checklist including line breaks.
      </p>
      <div className="mission-action-row">
        <button
          type="button"
          disabled={busy || oversized || recipe.availability !== 'enabled'}
          onClick={() => void prepare()}
        >
          Preview draft
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setPreview(null);
            request.current = null;
            void onRefresh().catch((cause) => setError(recipeError(cause)));
          }}
        >
          Refresh recipe
        </button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      {oversized ? (
        <p role="alert">Shorten values to 2,000 characters. Your entered text has been retained.</p>
      ) : null}
      {preview ? (
        <section aria-label="Draft preview">
          <h3 tabIndex={-1} ref={heading}>
            Draft preview
          </h3>
          {issues.length ? (
            <ul role="alert">
              {issues.map((issue, index) => (
                <li key={index}>
                  {issue.path}: {issue.code.replaceAll('_', ' ').toLowerCase()}
                  {issue.limit
                    ? ` (limit ${issue.limit}, actual ${issue.actual ?? 'not valid'})`
                    : ''}
                </li>
              ))}
            </ul>
          ) : null}
          {preview.expanded ? (
            <>
              <h4>Outcome</h4>
              <p className="recipe-text">
                {preview.projection?.objective ?? preview.expanded.outcome}
              </p>
              <h4>Proposed acceptance checklist</h4>
              <p className="recipe-text">
                {preview.projection?.completionEvidence ??
                  preview.expanded.acceptanceChecklist.join('\n')}
              </p>
              <h4>Suggested roles</h4>
              <ul>
                {preview.expanded.suggestedRoles.map((role, i) => (
                  <li key={i}>{role}</li>
                ))}
              </ul>
            </>
          ) : null}
          <button
            type="button"
            className="primary"
            disabled={busy || !preview.previewId}
            onClick={() => void create()}
          >
            Create draft
          </button>
        </section>
      ) : null}
    </section>
  );
}
