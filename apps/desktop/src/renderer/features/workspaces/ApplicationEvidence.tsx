import type { ApplicationInfoView } from '@threadhelm/contracts';

export function ApplicationEvidence({
  info,
  storageDegraded,
}: {
  info: ApplicationInfoView | null;
  storageDegraded: boolean;
}) {
  return (
    <section className="setup-check" aria-labelledby="application-evidence-heading">
      <div className="setup-check-number" aria-hidden="true">
        3
      </div>
      <div>
        <p className="eyebrow">Application health</p>
        <h2 id="application-evidence-heading">Confirm this local installation</h2>
        <p>
          ThreadHelm keeps coordination data on this machine and reports the runtime it is using.
        </p>
        <dl className="setup-evidence">
          <dt>Version</dt>
          <dd>{info?.version ?? 'Loading…'}</dd>
          <dt>Runtime</dt>
          <dd>{info ? `Electron ${info.electronVersion}` : 'Loading…'}</dd>
          <dt>Platform</dt>
          <dd>{info?.arch === 'x64' ? 'Windows x64' : (info?.arch ?? 'Loading…')}</dd>
          <dt>Distribution</dt>
          <dd>Unsigned local application</dd>
          <dt>Storage</dt>
          <dd>{storageDegraded ? 'Degraded — durable changes blocked' : 'Healthy'}</dd>
        </dl>
        <p className={storageDegraded ? 'notice error' : 'hint'} role="status">
          {storageDegraded
            ? 'Live controls remain available. Launches and durable changes stay blocked until storage recovers.'
            : 'Local storage is available for approved workspaces, profiles, memory, and missions.'}
        </p>
      </div>
    </section>
  );
}
