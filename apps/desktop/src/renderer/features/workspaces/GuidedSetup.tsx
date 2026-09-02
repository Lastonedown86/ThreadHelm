import { useStore } from '../../store.js';
import { ApplicationEvidence } from './ApplicationEvidence.js';
import { ProviderReadiness } from './ProviderReadiness.js';
import { WorkspacePanel } from './WorkspacePanel.js';

export function GuidedSetup() {
  const { state } = useStore();
  return (
    <main className="guided-setup" aria-labelledby="guided-setup-heading">
      <header className="workspace-page-header">
        <p className="eyebrow">Local setup</p>
        <h1 id="guided-setup-heading">Prepare ThreadHelm for a mission</h1>
        <p>
          Complete three explained checks. ThreadHelm will not sign in to providers or approve
          folders for you.
        </p>
      </header>
      <section className="setup-check" aria-label="Workspace approval check">
        <div className="setup-check-number" aria-hidden="true">
          1
        </div>
        <div>
          <p className="eyebrow">Workspace access</p>
          <WorkspacePanel />
        </div>
      </section>
      <section className="setup-check" aria-label="Provider readiness check">
        <div className="setup-check-number" aria-hidden="true">
          2
        </div>
        <div>
          <p className="eyebrow">Provider readiness</p>
          <ProviderReadiness />
        </div>
      </section>
      <ApplicationEvidence info={state.appInfo} storageDegraded={state.storageDegraded} />
    </main>
  );
}
