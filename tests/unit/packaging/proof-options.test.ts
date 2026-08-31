import { describe, expect, it, vi } from 'vitest';
import { selectProofInvocation } from '../../../apps/desktop/src/main/proof-options.js';

const node = 'C:\\Program Files\\nodejs\\node.exe';
describe('explicit diagnostic executable selection', () => {
  it('does not inspect executables or select a runner during normal launch', () => {
    const isFile = vi.fn();
    expect(selectProofInvocation(['ThreadHelm.exe'], 'win32', isFile)).toBeUndefined();
    expect(isFile).not.toHaveBeenCalled();
  });
  it('preserves the legacy diagnostic executable default and literal arguments', () => {
    expect(
      selectProofInvocation(['app', '--threadhelm-proof', 'fixture.js', '--arg'], 'win32'),
    ).toEqual({ fixtureArgs: ['fixture.js', '--arg'] });
  });
  it('selects only the explicitly supplied absolute node file and does not reinterpret fixture arguments', () => {
    const isFile = vi.fn(() => true);
    expect(
      selectProofInvocation(
        ['app', '--threadhelm-proof-node', node, 'fixture.mjs', '--bridge-path', 'bridge.exe'],
        'win32',
        isFile,
      ),
    ).toEqual({ executable: node, fixtureArgs: ['fixture.mjs', '--bridge-path', 'bridge.exe'] });
    expect(isFile).toHaveBeenCalledExactlyOnceWith(node);
  });
  it.each([
    'node.exe',
    '\\node.exe',
    '\\\\server\\share\\node.exe',
    'C:\\tools\\cmd.exe',
    'C:\\node.exe:stream',
    'C:\\node.exe\0',
  ])('rejects unsafe diagnostic executable %s', (value) => {
    expect(() =>
      selectProofInvocation(
        ['app', '--threadhelm-proof-node', value, 'fixture.mjs'],
        'win32',
        () => true,
      ),
    ).toThrow('INVALID_PROOF_NODE');
  });
  it('rejects a missing file, directory, or non-Windows explicit runner', () => {
    expect(() =>
      selectProofInvocation(
        ['app', '--threadhelm-proof-node', node, 'fixture.mjs'],
        'win32',
        () => false,
      ),
    ).toThrow('INVALID_PROOF_NODE');
    expect(() =>
      selectProofInvocation(
        ['app', '--threadhelm-proof-node', node, 'fixture.mjs'],
        'linux',
        () => true,
      ),
    ).toThrow('INVALID_PROOF_NODE');
  });
  it.each([
    ['--threadhelm-proof-node'],
    ['--threadhelm-proof-node', node],
    ['--threadhelm-proof-node', node, 'fixture.mjs', '--threadhelm-proof'],
    ['--threadhelm-proof', 'fixture.mjs', '--threadhelm-proof'],
  ])(
    'fails malformed/ambiguous proof invocation without falling back to normal launch: %j',
    (...args) => {
      expect(() => selectProofInvocation(['app', ...args], 'win32', () => true)).toThrow(
        'INVALID_PROOF_INVOCATION',
      );
    },
  );
});
