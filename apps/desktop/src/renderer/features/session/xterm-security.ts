/**
 * Terminal confinement (T060). Every byte from a provider is untrusted:
 * hyperlinks are inert, clipboard/window/file escape sequences are swallowed,
 * titles never reach the DOM, and no addon other than fit is loaded.
 */

import type { ITerminalOptions, Terminal } from '@xterm/xterm';
import { SCROLLBACK_LINES } from '@threadhelm/contracts';

/** OSC identifiers that could reach outside the terminal. */
export const SWALLOWED_OSC = [
  7, // current working directory report
  8, // hyperlink (also inert via linkHandler)
  9, // ConEmu / iTerm2 notifications
  52, // clipboard
  777, // rxvt notifications
  1337, // iTerm2 file transfer / proprietary
] as const;

/** CSI window manipulation (XTWINOPS). */
export const SWALLOWED_CSI = ['t'] as const;

export const SECURITY_INVARIANTS = {
  scrollback: SCROLLBACK_LINES,
  allowProposedApi: false,
  cursorBlink: false,
  windowOptions: 'none',
  linkHandler: 'inert',
  addons: ['fit'],
  swallowedOsc: SWALLOWED_OSC,
  swallowedCsi: SWALLOWED_CSI,
  titlesIgnored: true,
} as const;

export function createSecureTerminalOptions(): ITerminalOptions {
  return {
    scrollback: SCROLLBACK_LINES,
    allowProposedApi: false,
    windowOptions: {},
    linkHandler: { activate: () => undefined },
    windowsPty: { backend: 'conpty' },
    disableStdin: false,
    cursorBlink: false,
    convertEol: false,
    fontFamily: 'Consolas, "Cascadia Mono", monospace',
    fontSize: 14,
  };
}

export function hardenTerminal(term: Terminal): void {
  for (const id of SWALLOWED_OSC) term.parser.registerOscHandler(id, () => true);
  for (const final of SWALLOWED_CSI) term.parser.registerCsiHandler({ final }, () => true);
  // Titles are terminal-derived text; they never become DOM or app state.
  term.onTitleChange(() => undefined);
}
