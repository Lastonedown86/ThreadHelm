import { describe, expect, it } from 'vitest';
import { resolve, join } from 'node:path';
import { acceptanceFailure } from '../../acceptance/helpers/acceptance-failure.js';

describe('curated installed acceptance failures', () => {
  const root = resolve('test-artifact');
  it('retains the exact relative PE failure path without file content', () => {
    expect(
      acceptanceFailure(
        'native architecture',
        [{ message: `Native architecture does not match x64: ${join(root, 'squirrel.exe')}` }],
        root,
      ),
    ).toEqual({
      name: 'native architecture',
      code: 'Native architecture does not match x64',
      relativePath: 'squirrel.exe',
    });
  });
  it('does not retain raw assertion values, logs, credential text or paths outside the artifact', () => {
    const messages = [
      { message: 'expected log sk-secret credential=private-token to match' },
      { message: `Invalid native PE file: ${resolve(root, '..', 'secret.node')}` },
    ];
    expect(acceptanceFailure('startup', messages, root)).toEqual({
      name: 'startup',
      code: 'ASSERTION_OR_HOOK_FAILED',
    });
    expect(acceptanceFailure('x'.repeat(1000), messages, root).name).toHaveLength(160);
  });
});
