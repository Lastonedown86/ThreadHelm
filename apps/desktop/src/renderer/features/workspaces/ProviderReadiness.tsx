/**
 * Provider readiness (T046). Each built-in adapter's sanitized state; launch
 * is offered only when the adapter is actually available.
 */

import { useEffect, useRef, useState } from 'react';
import type { Availability } from '@threadhelm/contracts';
import { api, call } from '../../api.js';
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
  const [checkState, setCheckState] = useState<'idle' | 'checking' | 'checked' | 'failed'>('idle');
  const pending = useRef(false);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );
  const recheck = async () => {
    if (pending.current) return;
    pending.current = true;
    const current = ++generation.current;
    setCheckState('checking');
    try {
      // Main emits provider-specific readiness events. Do not apply a second,
      // possibly obsolete response snapshot over the store's current evidence.
      await call(api.providers.listReadiness(undefined));
      if (generation.current === current) setCheckState('checked');
    } catch {
      if (generation.current === current) setCheckState('failed');
    } finally {
      pending.current = false;
    }
  };
  const chosen = workspaces.find((w) => w.id === workspaceId) ?? workspaces[0];

  return (
    <section className="panel" aria-labelledby="providers-heading">
      <h2 id="providers-heading">Provider readiness</h2>
      <button type="button" disabled={checkState === 'checking'} onClick={() => void recheck()}>
        {checkState === 'checking' ? 'Checking...' : 'Check again'}
      </button>
      {checkState === 'checking' ? (
        <p role="status">Checking providers. Previous results remain below.</p>
      ) : null}
      {checkState === 'checked' ? (
        <p role="status">Provider check complete. Review each result below.</p>
      ) : null}
      {checkState === 'failed' ? (
        <p role="alert">
          Could not check provider readiness. Previous results are shown; use Check again to retry.
        </p>
      ) : null}
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
            <div className="hint">
              Last checked{' '}
              <time dateTime={readiness.probedAt}>
                {new Date(readiness.probedAt).toLocaleString()}
              </time>
            </div>
            {readiness.availability === 'available' && chosen ? (
              <button
                type="button"
                className="small primary"
                disabled={
                  state.storageDegraded || checkState === 'checking' || checkState === 'failed'
                }
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
