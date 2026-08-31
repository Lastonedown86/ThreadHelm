import { describe, expect, it, vi } from 'vitest';
import { handleSquirrelLifecycle } from '../../../apps/desktop/src/main/squirrel-lifecycle.js';

const executable = 'C:\\Users\\Fixture\\AppData\\Local\\ThreadHelm\\app-0.1.0\\ThreadHelm.exe';

describe('Squirrel lifecycle dispatch', () => {
  it.each([
    ['--squirrel-install', '--createShortcut'],
    ['--squirrel-updated', '--createShortcut'],
    ['--squirrel-uninstall', '--removeShortcut'],
  ])('handles %s using only the adjacent updater', async (event, operation) => {
    const update = vi.fn().mockResolvedValue(undefined);
    expect(
      await handleSquirrelLifecycle('win32', [executable, event, 'ignored'], executable, update),
    ).toBe(0);
    expect(update).toHaveBeenCalledExactlyOnceWith(
      'C:\\Users\\Fixture\\AppData\\Local\\ThreadHelm\\Update.exe',
      operation,
      'ThreadHelm.exe',
    );
  });

  it('quits obsolete versions without invoking the updater', async () => {
    const update = vi.fn();
    expect(
      await handleSquirrelLifecycle(
        'win32',
        [executable, '--squirrel-obsolete'],
        executable,
        update,
      ),
    ).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });

  it.each(['--squirrel-firstrun', '--squirrel-install-extra', '--threadhelm-proof', ''])(
    'leaves normal launch %s alone',
    (event) => {
      const update = vi.fn();
      expect(
        handleSquirrelLifecycle('win32', [executable, event], executable, update),
      ).toBeUndefined();
      expect(update).not.toHaveBeenCalled();
    },
  );

  it('does not process Windows installer events on other platforms', () => {
    expect(
      handleSquirrelLifecycle('linux', [executable, '--squirrel-install'], executable),
    ).toBeUndefined();
  });

  it('fails closed when the updater fails or times out', async () => {
    const update = vi.fn().mockRejectedValue(new Error('fixture failure'));
    expect(
      await handleSquirrelLifecycle(
        'win32',
        [executable, '--squirrel-uninstall'],
        executable,
        update,
      ),
    ).toBe(1);
  });
});
