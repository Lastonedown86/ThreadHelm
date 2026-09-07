import type { MissionDraftRecipeContext } from '@threadhelm/contracts';
export function RecipeContext({
  context,
  roles,
  onChange,
}: {
  context: MissionDraftRecipeContext;
  roles: string[];
  onChange(roles: string[]): void;
}) {
  return (
    <section aria-label="Recipe context">
      <h2>Recipe context</h2>
      <p>
        From {context.name} · {context.origin} · revision{' '}
        <span title={context.revisionId}>{context.revisionId.slice(-8)}</span>
      </p>
      <p>These role suggestions are editable notes. Select actual agents in Crew.</p>
      {roles.map((role, i) => (
        <label className="field" key={i}>
          Suggested role {i + 1}
          <textarea
            value={role}
            onChange={(e) =>
              onChange(roles.map((value, index) => (index === i ? e.target.value : value)))
            }
          />
        </label>
      ))}
    </section>
  );
}
