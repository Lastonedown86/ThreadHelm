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
import { StreamClient, type StreamFailure } from './stream.js';
import { createSecureTerminalOptions, hardenTerminal } from './xterm-security.js';

export interface TerminalEntry {
  term: Terminal;
  fit: FitAddon;
  element: HTMLDivElement;
  opened: boolean;
  stream: StreamClient | null;
}

export interface TerminalHooks {
  isSelected(sessionId: string): boolean;
  onOutput(sessionId: string): void;
  onTruncated(sessionId: string, count: number): void;
  onStreamFailure(sessionId: string, reason: StreamFailure): void;
  onInputRejected(sessionId: string, code: string): void;
}

const entries = new Map<string, TerminalEntry>();
const subscribed = new Set<string>();
let hooks: TerminalHooks | null = null;

export function installTerminalHooks(next: TerminalHooks): () => void {
  hooks = next;
  window.addEventListener('message', onWindowMessage);
  return () => {
    window.removeEventListener('message', onWindowMessage);
    hooks = null;
  };
}

function onWindowMessage(event: MessageEvent): void {
  const data: unknown = event.data;
  if (!data || typeof data !== 'object') return;
  const { type, sessionId } = data as { type?: unknown; sessionId?: unknown };
  if (type !== api.streamPortChannel || typeof sessionId !== 'string') return;
  const port = event.ports[0];
  if (!port) return;
  attachStream(sessionId, port);
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

/** Request the session's output port once; the host delivers it via postMessage. */
export function subscribeOutput(sessionId: string): void {
  if (subscribed.has(sessionId)) return;
  subscribed.add(sessionId);
  ensureTerminal(sessionId);
  void call(api.sessions.subscribeOutput({ sessionId })).catch(() => subscribed.delete(sessionId));
}

function attachStream(sessionId: string, port: MessagePort): void {
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

export function getTerminal(sessionId: string): TerminalEntry | undefined {
  return entries.get(sessionId);
}

export function disposeTerminal(sessionId: string): void {
  const entry = entries.get(sessionId);
  if (!entry) return;
  entry.stream?.close();
  entry.term.dispose();
  entry.element.remove();
  entries.delete(sessionId);
  subscribed.delete(sessionId);
}
