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
