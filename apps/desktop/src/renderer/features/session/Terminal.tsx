/**
 * Live session output (T048). Attaches the selected session's persistent
 * xterm surface, fits it to the pane, and reports dimension changes to main.
 */

import { useEffect, useRef } from 'react';
import type { SessionView } from '@threadhelm/contracts';
import { api, call } from '../../api.js';
import { describeScrollback, describeTruncation } from './buffer.js';
import { ensureTerminal } from './terminals.js';

interface Props {
  session: SessionView;
  truncationCount: number;
  streamFailure: string | null;
  inputNotice: string | null;
}

export function TerminalPane({ session, truncationCount, streamFailure, inputNotice }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const sessionId = session.id;

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const entry = ensureTerminal(sessionId);
    container.appendChild(entry.element);
    if (!entry.opened) {
      entry.term.open(entry.element);
      entry.opened = true;
    }

    let last = { columns: 0, rows: 0 };
    const applyFit = () => {
      entry.fit.fit();
      const { cols, rows } = entry.term;
      if (cols === last.columns && rows === last.rows) return;
      last = { columns: cols, rows };
      void call(api.sessions.resize({ sessionId, columns: cols, rows })).catch(() => undefined);
    };
    applyFit();
    // A delayed mount or session switch must not take the user's next key
    // away from the session list, a dialog, or another focused control.
    const focused = document.activeElement;
    if (!focused || focused === document.body || container.contains(focused)) {
      entry.term.focus();
    }

    const observer = new ResizeObserver(() => applyFit());
    observer.observe(container);
    return () => {
      observer.disconnect();
      entry.element.remove();
    };
  }, [sessionId]);

  return (
    <section className="terminal-pane" aria-labelledby="terminal-heading">
      <h2 id="terminal-heading" className="visually-hidden">
        Terminal for {session.providerDisplayName} in {session.workspaceDisplayPath}
      </h2>
      <div
        ref={host}
        id="terminal"
        className="terminal-host"
        tabIndex={-1}
        aria-label={`Terminal for ${session.providerDisplayName} in ${session.workspaceDisplayPath}`}
        aria-keyshortcuts="F6"
      />
      <p className="terminal-hint">
        Typing goes to the selected agent. Press <kbd>F6</kbd> to move focus to the session
        controls.
      </p>
      <div className="terminal-status" aria-live="polite">
        {truncationCount > 0 ? (
          <p className="notice warning">{describeTruncation(truncationCount)}</p>
        ) : null}
        {streamFailure ? (
          <p className="notice error">
            The output stream for this session failed ({streamFailure}). Live output stopped; the
            session itself may still be running.
          </p>
        ) : null}
        {inputNotice ? <p className="notice">{inputNotice}</p> : null}
        <p className="hint">{describeScrollback()}</p>
      </div>
    </section>
  );
}
