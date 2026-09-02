import { AgentProfileList } from './AgentProfileList.js';
import { AgentStarterLibrary } from './AgentStarterLibrary.js';

export function AgentLibraryWorkspace() {
  return (
    <main className="agent-library-workspace" aria-labelledby="agent-library-heading">
      <header className="workspace-page-header">
        <p className="eyebrow">Agent library</p>
        <h1 id="agent-library-heading">Choose or create the right worker</h1>
        <p>
          Starters help shape a worker. Reviewed local profiles stay separate and remain inert until
          an exact launch or mission binds them.
        </p>
      </header>
      <AgentStarterLibrary />
      <section
        className="agent-library-region private-profile-region"
        aria-labelledby="local-profiles-heading"
      >
        <header>
          <p className="eyebrow">Private to this machine</p>
          <h2 id="local-profiles-heading">Local profiles and Profile Studio</h2>
          <p>
            Import exact JSON or open a saved profile to inspect its goal, abilities, provenance,
            compatibility, and revision history.
          </p>
        </header>
        <AgentProfileList />
      </section>
    </main>
  );
}
