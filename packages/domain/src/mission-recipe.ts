import {
  MissionRecipeContent,
  MissionRecipeValues,
  MissionRecipeExpanded,
  MissionRecipeProjection,
  isSafeAuthoredText,
  recipeUtf8Bytes,
  type MissionRecipeIssue,
} from '@threadhelm/contracts';

export interface RecipeExpansion {
  expanded: MissionRecipeExpanded | null;
  projection: { objective: string; completionEvidence: string } | null;
  issues: MissionRecipeIssue[];
}

/** Bounded one-pass substitution. Inserted values are never parsed as tokens. */
export function expandMissionRecipe(input: unknown, supplied: unknown): RecipeExpansion {
  const issues: MissionRecipeIssue[] = [];
  const failed = (): RecipeExpansion => ({ expanded: null, projection: null, issues });
  const parsed = MissionRecipeContent.safeParse(input);
  if (!parsed.success) {
    issues.push({ code: 'INVALID_RECIPE', path: 'content' });
    return failed();
  }
  const recipe = parsed.data;
  const declared = new Set(recipe.variables.map((v) => v.key));
  if (typeof supplied !== 'object' || supplied === null || Array.isArray(supplied)) {
    issues.push({ code: 'INVALID_RECIPE', path: 'values' });
    return failed();
  }
  if (Object.keys(supplied).some((key) => !declared.has(key))) {
    issues.push({ code: 'UNDECLARED_VARIABLE', path: 'values' });
    return failed();
  }
  const valueResult = MissionRecipeValues.safeParse(supplied);
  if (!valueResult.success) {
    issues.push({ code: 'FIELD_LIMIT', path: 'values', limit: 2000 });
    return failed();
  }
  const values = valueResult.data;
  for (const variable of recipe.variables) {
    if (variable.required && !(values[variable.key] ?? '').trim())
      issues.push({ code: 'REQUIRED_VALUE', path: `values.${variable.key}` });
  }
  if (issues.length) return failed();
  let total = Math.max(0, recipe.acceptanceChecklist.length - 1);
  const expand = (text: string, path: string): string => {
    const pieces: string[] = [];
    const append = (piece: string) => {
      total += piece.length;
      if (total > 64000) {
        issues.push({ code: 'EXPANDED_LIMIT', path, limit: 64000, actual: total });
        return false;
      }
      pieces.push(piece);
      return true;
    };
    for (let i = 0; i < text.length;) {
      if (text.startsWith('\\{{', i)) {
        if (!append('{{')) break;
        i += 3;
      } else if (text.startsWith('{{', i)) {
        const end = text.indexOf('}}', i + 2);
        if (end < 0 || !declared.has(text.slice(i + 2, end))) {
          issues.push({ code: 'UNDECLARED_VARIABLE', path });
          break;
        }
        if (!append(values[text.slice(i + 2, end)] ?? '')) break;
        i = end + 2;
      } else {
        if (!append(text[i]!)) break;
        i++;
      }
    }
    const result = pieces.join('');
    if (!isSafeAuthoredText(result)) issues.push({ code: 'UNSAFE_CONTENT', path });
    return result;
  };
  const outcome = expand(recipe.outcomeScaffold, 'outcome');
  if (issues.length) return failed();
  const checklist: string[] = [];
  for (const [i, text] of recipe.acceptanceChecklist.entries()) {
    checklist.push(expand(text, `acceptanceChecklist.${i}`));
    if (issues.length) return failed();
  }
  const roles: string[] = [];
  for (const [i, text] of recipe.suggestedRoles.entries()) {
    roles.push(expand(text, `suggestedRoles.${i}`));
    if (issues.length) return failed();
  }
  const expanded = MissionRecipeExpanded.parse({
    outcome,
    acceptanceChecklist: checklist,
    suggestedRoles: roles,
  });
  const projection = { objective: outcome.trim(), completionEvidence: checklist.join('\n').trim() };
  for (const [field, max] of [
    ['objective', 4000],
    ['completionEvidence', 2000],
  ] as const) {
    const actual = Math.max(projection[field].length, recipeUtf8Bytes(projection[field]));
    if (actual > max) issues.push({ code: 'COMPOSER_LIMIT', path: field, limit: max, actual });
  }
  return {
    expanded,
    projection: issues.length ? null : MissionRecipeProjection.parse(projection),
    issues,
  };
}
/** A refresh never changes recipe identity; match literal fields by stable key. */
export function reconcileRecipeValues(
  previous: readonly { key: string; label: string; required: boolean }[],
  current: readonly { key: string; label: string; required: boolean }[],
  values: Readonly<Record<string, string>>,
): { values: Record<string, string>; changed: string[]; removed: string[] } {
  const before = new Map(previous.map((v) => [v.key, v]));
  const after = new Set(current.map((v) => v.key));
  return {
    values: Object.fromEntries(
      current.filter((v) => Object.hasOwn(values, v.key)).map((v) => [v.key, values[v.key]!]),
    ),
    changed: current
      .filter((v) => {
        const old = before.get(v.key);
        return old && (old.label !== v.label || old.required !== v.required);
      })
      .map((v) => v.key),
    removed: previous.filter((v) => !after.has(v.key)).map((v) => v.key),
  };
}
