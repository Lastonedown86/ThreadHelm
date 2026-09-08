import { useState } from 'react';
import type { MissionRecipeEditor, MissionRecipeEditorContent } from '@threadhelm/contracts';
import { api, call } from '../../api.js';
import { recipeError } from './RecipePreview.js';

export type RecipeSource = { kind: 'draft' | 'mission'; id: string; version: number };
export function RecipeSourceSelection({
  source,
  onOpen,
}: {
  source: RecipeSource;
  onOpen(editor: MissionRecipeEditor): void;
}) {
  type Field = 'objective' | 'completionEvidence' | 'suggestedRoles';
  const [fields, setFields] = useState<Field[]>([]);
  const [preview, setPreview] = useState<{
    previewId: string;
    content: MissionRecipeEditorContent;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <section aria-label="Select mission structure">
      <h2>Choose content to save</h2>
      <p>
        Nothing is selected automatically. Review project-specific text before making a personal
        recipe. Assignments, profiles, access and runtime choices are excluded.
      </p>
      {(
        [
          ['objective', 'Outcome'],
          ['completionEvidence', 'Acceptance checklist'],
          ['suggestedRoles', 'Inert role suggestions'],
        ] as const
      ).map(([key, label]) => (
        <label className="check-field" key={key}>
          <input
            type="checkbox"
            checked={fields.includes(key)}
            disabled={busy}
            onChange={(e) => {
              setFields(e.target.checked ? [...fields, key] : fields.filter((f) => f !== key));
              setPreview(null);
            }}
          />
          {label}
        </label>
      ))}
      <button
        type="button"
        disabled={busy || !fields.length}
        onClick={() => {
          setBusy(true);
          setError('');
          void call(api.missionRecipes.previewSource({ source, fields }))
            .then(setPreview)
            .catch((c) => setError(recipeError(c)))
            .finally(() => setBusy(false));
        }}
      >
        Preview selected content
      </button>
      {error ? <p role="alert">{error}</p> : null}
      {preview ? (
        <>
          <h3>Selected content preview</h3>
          <p>Correct oversized or project-specific text here before saving a recoverable editor.</p>
          <label className="field">
            Selected outcome
            <textarea
              disabled={busy}
              value={preview.content.outcomeScaffold}
              onChange={(e) =>
                setPreview({
                  ...preview,
                  content: { ...preview.content, outcomeScaffold: e.target.value },
                })
              }
            />
            <span>{preview.content.outcomeScaffold.length}/8,000 characters</span>
          </label>
          {(['acceptanceChecklist', 'suggestedRoles'] as const).map((field) =>
            preview.content[field].map((t, i) => (
              <label className="field" key={`${field}-${i}`}>
                Selected {field === 'acceptanceChecklist' ? 'checklist item' : 'role'} {i + 1}
                <textarea
                  disabled={busy}
                  value={t}
                  onChange={(e) =>
                    setPreview({
                      ...preview,
                      content: {
                        ...preview.content,
                        [field]: preview.content[field].map((v, j) =>
                          j === i ? e.target.value : v,
                        ),
                      },
                    })
                  }
                />
                <span>{t.length}/1,000 characters</span>
              </label>
            )),
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void call(
                api.missionRecipes.openEditor({
                  sourcePreviewId: preview.previewId,
                  content: preview.content,
                }),
              )
                .then(onOpen)
                .catch((c) => setError(recipeError(c)))
                .finally(() => setBusy(false));
            }}
          >
            Use selected content
          </button>
        </>
      ) : null}
    </section>
  );
}
