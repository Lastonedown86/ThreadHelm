import { describe, expect, it } from 'vitest';
import * as domain from '@threadhelm/domain';
const recipe = {
  name: 'Test',
  description: '',
  outcomeScaffold: 'Inspect {{item}}',
  acceptanceChecklist: ['Show {{item}}'],
  suggestedRoles: ['Reader'],
  variables: [{ key: 'item', label: 'Item', required: true }],
};
describe('literal recipe expansion', () => {
  it('reconciles keyed values and discloses changed or removed declarations', () => {
    expect(
      domain.reconcileRecipeValues(
        [
          { key: 'keep', label: 'Keep', required: true },
          { key: 'changed', label: 'Before', required: false },
          { key: 'gone', label: 'Gone', required: false },
        ],
        [
          { key: 'keep', label: 'Keep', required: true },
          { key: 'changed', label: 'After', required: true },
          { key: 'new', label: 'New', required: false },
        ],
        { keep: 'literal $value', changed: 'retain for review', gone: 'removed' },
      ),
    ).toEqual({
      values: { keep: 'literal $value', changed: 'retain for review' },
      changed: ['changed'],
      removed: ['gone'],
    });
  });
  it('exports a pure non-executable expansion function', () => {
    expect(domain).toHaveProperty('expandMissionRecipe');
  });
  it('copies literal values once and never evaluates tokens or commands inside values', () => {
    const result = domain.expandMissionRecipe(recipe, {
      item: '{{other}}; echo hello https://example.com',
    });
    expect(result.issues).toEqual([]);
    expect(result.projection?.objective).toBe('Inspect {{other}}; echo hello https://example.com');
  });
  it('requires declared required values and accepts empty optional values', () => {
    expect(domain.expandMissionRecipe(recipe, {}).issues[0]?.code).toBe('REQUIRED_VALUE');
    expect(domain.expandMissionRecipe(recipe, { item: 'x', extra: 'y' }).issues[0]?.code).toBe(
      'UNDECLARED_VARIABLE',
    );
    expect(
      domain.expandMissionRecipe(
        { ...recipe, variables: [{ ...recipe.variables[0], required: false }] },
        {},
      ).projection?.objective,
    ).toBe('Inspect');
  });
  it('handles escaped tokens and rejects malformed/undeclared tokens', () => {
    expect(
      domain.expandMissionRecipe(
        { ...recipe, outcomeScaffold: '\\{{literal}} {{item}}' },
        { item: 'ok' },
      ).projection?.objective,
    ).toBe('{{literal}} ok');
    for (const text of ['{{missing}}', '{{item', '{{ item }}']) {
      expect(
        domain.expandMissionRecipe({ ...recipe, outcomeScaffold: text }, { item: 'ok' }).issues
          .length,
      ).toBeGreaterThan(0);
    }
  });
  it('checks aggregate expansion before constructing an unbounded output', () => {
    const huge = { ...recipe, outcomeScaffold: '{{item}}'.repeat(1000) };
    expect(domain.expandMissionRecipe(huge, { item: 'x'.repeat(2000) }).issues[0]?.code).toBe(
      'EXPANDED_LIMIT',
    );
  });
  it('enforces UTF-8 bytes and checklist separator bounds without truncation', () => {
    const result = domain.expandMissionRecipe(
      { ...recipe, outcomeScaffold: '{{item}}{{item}}' },
      { item: '漢'.repeat(1000) },
    );
    expect(result.projection).toBeNull();
    expect(result.expanded?.outcome).toHaveLength(2000);
    expect(result.issues.some((i) => i.code === 'COMPOSER_LIMIT')).toBe(true);
    const checklist = { ...recipe, acceptanceChecklist: ['a'.repeat(1000), 'b'.repeat(1000)] };
    expect(
      domain
        .expandMissionRecipe(checklist, { item: 'ok' })
        .issues.some((i) => i.path === 'completionEvidence'),
    ).toBe(true);
  });
});
