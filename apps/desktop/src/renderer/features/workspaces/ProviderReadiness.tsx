/**
 * Provider readiness (T046). Each built-in adapter's sanitized state; launch
 * is offered only when the adapter is actually available.
 */

import { useState } from 'react';
import type { Availability } from '@threadhelm/contracts';
import { useStore } from '../../store.js';

const AVAILABILITY_LABEL: Record<Availability, string> = {
  available: 'Available',
  missing: 'Not installed',
  unsupported: 'Unsupported version',
  unauthenticated: 'Not signed in',
  error: 'Check failed',
};

export function ProviderReadiness() {
  const { state, actions } = useStore();
  const workspaces = state.workspaces.filter((workspace) => workspace.revokedAt === null);
  const [workspaceId, setWorkspaceId] = useState<string>('');
  const chosen = workspaces.find((w) => w.id === workspaceId) ?? workspaces[0];

  return (
    <section className="panel" aria-labelledby="providers-heading">
      <h2 id="providers-heading">Agents</h2>
      {workspaces.length > 0 ? (
        <label className="field">
          Launch in
          <select value={chosen?.id ?? ''} onChange={(event) => setWorkspaceId(event.target.value)}>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.displayPath}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="hint">Approve a folder to enable launching.</p>
      )}
      <ul className="list">
        {state.readiness.map((readiness) => (
          <li key={readiness.providerId}>
            <div>
              <strong>{readiness.displayName}</strong>{' '}
              <span className={`badge ${readiness.availability}`}>
                {AVAILABILITY_LABEL[readiness.availability]}
              </span>
            </div>
            <div className="hint">
              version {readiness.version ?? 'unknown'} · auth {readiness.authentication}
            </div>
            <div className="hint">{readiness.safeSummary}</div>
            {readiness.availability === 'available' && chosen ? (
              <button
                type="button"
                className="small primary"
                disabled={state.storageDegraded}
                onClick={() =>
                  actions.openLaunch({ workspaceId: chosen.id, providerId: readiness.providerId })
                }
                aria-label={`Launch ${readiness.displayName} in ${chosen.displayPath}`}
              >
                Launch in {chosen.displayPath}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
