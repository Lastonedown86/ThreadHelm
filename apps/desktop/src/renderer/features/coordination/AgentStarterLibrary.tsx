import { AgentTemplateLibrary } from './AgentTemplateLibrary.js';

export function AgentStarterLibrary() {
  return (
    <section className="agent-library-region" aria-labelledby="agent-starters-heading">
      <header>
        <p className="eyebrow">Start with guidance</p>
        <h2 id="agent-starters-heading">Generic starters and saved drafts</h2>
        <p>
          Choose the job this worker should do, then review its goal, abilities, and provider
          request before saving.
        </p>
      </header>
      <AgentTemplateLibrary />
    </section>
  );
}
