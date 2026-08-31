import { useEffect, useState, type ComponentProps } from 'react';
import type { TerminalPane } from './Terminal.js';
import { loadTerminalPane } from './terminal-loader.js';

/** No terminal implementation is requested until a session is selected. */
export function LazyTerminalPane(props: ComponentProps<typeof TerminalPane>) {
  const [Pane, setPane] = useState<typeof TerminalPane | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void loadTerminalPane().then(
      (module) => {
        if (!cancelled) setPane(() => module.TerminalPane);
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);
  if (Pane) return <Pane {...props} />;
  return (
    <section className="terminal-pane" aria-label="Session terminal">
      <div id="terminal" className="terminal-host" tabIndex={-1} aria-busy={!failed}>
        <p className={failed ? 'notice error' : 'hint'} role="status">
          {failed
            ? 'The terminal could not load. The session may still be running; its controls remain available.'
            : 'Loading terminal…'}
        </p>
      </div>
    </section>
  );
}
