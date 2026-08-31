/**
 * One xterm instance per live session, kept for the session's in-app
 * lifetime so switching sessions never loses recent output. Raw bytes live
 * only inside xterm's bounded buffer and vanish with the window.
 *
 * ponytail: module singleton; the store installs hooks once on mount.
 */

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { api, call } from '../../api.js';
import { StreamClient, type StreamPort } from './stream.js';
import { createSecureTerminalOptions, hardenTerminal } from './xterm-security.js';
import type { TerminalHooks } from './terminal-controller.js';

export interface TerminalEntry {
  term: Terminal;
  fit: FitAddon;
  element: HTMLDivElement;
  opened: boolean;
  stream: StreamClient | null;
}

const entries = new Map<string, TerminalEntry>();
let hooks: TerminalHooks | null = null;

export function setTerminalHooks(next: TerminalHooks | null): void {
  hooks = next;
}

export function ensureTerminal(sessionId: string): TerminalEntry {
  let entry = entries.get(sessionId);
  if (entry) return entry;
  const term = new Terminal(createSecureTerminalOptions());
  hardenTerminal(term);
  const fit = new FitAddon();
  term.loadAddon(fit);
  // xterm consumes Tab (it belongs to the PTY), so F6 is the keyboard exit:
  // it moves focus to the session controls without reaching the agent (FR-021).
  term.attachCustomKeyEventHandler((event) => {
    if (event.key !== 'F6') return true;
    if (event.type === 'keydown') {
      const escape =
        document.querySelector<HTMLElement>('.control-bar button:not([disabled])') ??
        document.querySelector<HTMLElement>('[data-focus-escape]');
      escape?.focus();
    }
    return false;
  });
  const element = document.createElement('div');
  element.className = 'terminal-surface';
  entry = { term, fit, element, opened: false, stream: null };
  entries.set(sessionId, entry);

  term.onData((data) => {
    if (!hooks?.isSelected(sessionId)) return;
    void call(api.sessions.sendInput({ sessionId, bytes: new TextEncoder().encode(data) })).catch(
      (error: unknown) => {
        const code = (error as { code?: string }).code ?? 'INTERNAL';
        hooks?.onInputRejected(sessionId, code);
      },
    );
  });
  return entry;
}

export function attachStream(sessionId: string, port: StreamPort): void {
  const entry = ensureTerminal(sessionId);
  entry.stream?.close();
  entry.stream = new StreamClient(
    sessionId,
    port,
    { write: (bytes, done) => entry.term.write(bytes, done) },
    {
      onOutput: () => hooks?.onOutput(sessionId),
      onTruncated: (count) => hooks?.onTruncated(sessionId, count),
      onFailure: (reason) => hooks?.onStreamFailure(sessionId, reason),
    },
  );
}

export function terminalSize(sessionId: string): { columns: number; rows: number } | undefined {
  const entry = entries.get(sessionId);
  if (entry?.opened) return { columns: entry.term.cols, rows: entry.term.rows };
  return undefined;
}

export function closeStream(sessionId: string): void {
  const entry = entries.get(sessionId);
  if (!entry) return;
  entry.stream?.close();
  entry.stream = null;
}

export function disposeTerminal(sessionId: string): void {
  const entry = entries.get(sessionId);
  if (!entry) return;
  entry.stream?.close();
  entry.term.dispose();
  entry.element.remove();
  entries.delete(sessionId);
}

export function disposeTerminals(): void {
  for (const sessionId of entries.keys()) disposeTerminal(sessionId);
}
