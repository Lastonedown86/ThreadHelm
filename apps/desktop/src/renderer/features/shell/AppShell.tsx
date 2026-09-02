import type { ReactNode } from 'react';

export interface AppShellProps {
  rail: ReactNode;
  workspace: ReactNode;
  contextToggle: ReactNode | null;
  context: ReactNode;
  terminal: ReactNode | null;
}

export function AppShell({ rail, workspace, contextToggle, context, terminal }: AppShellProps) {
  return (
    <div className="mission-app-shell">
      <a className="skip-link" href="#mission-workspace">
        Skip to mission content
      </a>
      {terminal ? (
        <a className="skip-link terminal-skip-link" href="#mission-terminal">
          Skip to terminal
        </a>
      ) : null}
      <div className="mission-shell-regions">
        <nav className="mission-shell-rail" aria-label="Mission workspace">
          {rail}
        </nav>
        <main id="mission-workspace" className="mission-shell-workspace" tabIndex={-1}>
          {contextToggle}
          {workspace}
        </main>
        <aside className="mission-shell-context" aria-label="Mission context">
          {context}
        </aside>
      </div>
      {terminal ? (
        <section id="mission-terminal" className="mission-shell-terminal" tabIndex={-1}>
          {terminal}
        </section>
      ) : null}
    </div>
  );
}
