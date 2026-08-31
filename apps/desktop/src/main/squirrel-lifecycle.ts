import { execFile } from 'node:child_process';
import { win32 } from 'node:path';

type ShortcutOperation = '--createShortcut' | '--removeShortcut';
type RunUpdate = (
  executable: string,
  operation: ShortcutOperation,
  shortcut: string,
) => Promise<void>;

const runUpdate: RunUpdate = (executable, operation, shortcut) =>
  new Promise((resolve, reject) => {
    execFile(executable, [operation, shortcut], { windowsHide: true, timeout: 10_000 }, (error) =>
      error ? reject(error) : resolve(),
    );
  });

/** Handle Squirrel events before opening storage, windows, or provider sessions. */
export function handleSquirrelLifecycle(
  platform: string,
  argv: readonly string[],
  executable: string,
  update: RunUpdate = runUpdate,
): Promise<number> | undefined {
  if (platform !== 'win32') return undefined;
  const event = argv[1];
  if (event === '--squirrel-obsolete') return Promise.resolve(0);
  let operation: ShortcutOperation;
  if (event === '--squirrel-install' || event === '--squirrel-updated') {
    operation = '--createShortcut';
  } else if (event === '--squirrel-uninstall') {
    operation = '--removeShortcut';
  } else {
    return undefined;
  }
  // Installed layout is <root>/app-<version>/ThreadHelm.exe. Never search PATH
  // or interpret installer arguments as commands or paths.
  const updater = win32.resolve(win32.dirname(executable), '..', 'Update.exe');
  return update(updater, operation, win32.basename(executable)).then(
    () => 0,
    () => 1,
  );
}
