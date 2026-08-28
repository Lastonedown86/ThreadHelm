/**
 * Per-session launch disclosure (T047). Shows the effective path, agent,
 * version, executable, and the boundary warning; requires a fresh explicit
 * confirmation every time. Nothing here is remembered between sessions.
 */

import { useEffect, useState } from 'react';
import type { LaunchPreviewView, SessionView } from '@threadhelm/contracts';
import { api, call } from '../../api.js';
import { Modal } from '../control/Modal.js';
import type { LaunchRequest } from '../../store.js';
import { LaunchError } from './LaunchErrors.js';

interface Props {
  request: LaunchRequest;
  terminal: { columns: number; rows: number };
  onLaunched: (session: SessionView) => void;
  onCancel: () => void;
}

function abbreviate(path: string | null): string {
  if (!path) return 'unknown';
  return path.length > 60 ? `…${path.slice(-57)}` : path;
}

export function LaunchDialog({ request, terminal, onLaunched, onCancel }: Props) {
  const [preview, setPreview] = useState<LaunchPreviewView | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    setConfirmed(false);
    call(
      api.sessions.previewLaunch({
        workspaceId: request.workspaceId,
        providerId: request.providerId,
        terminal,
      }),
    )
      .then((view) => {
        if (!cancelled) setPreview(view);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
    // terminal is a fresh object each render; only the request identity matters.
  }, [request.workspaceId, request.providerId]);

  const launch = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const session = await call(
        api.sessions.launch({
          previewToken: preview.previewToken,
          boundaryConfirmation: confirmed,
        }),
      );
      onLaunched(session);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <Modal title="Review this launch" onCancel={onCancel} describedBy="launch-boundary">
      {preview ? (
        <>
          <dl className="facts">
            <dt>Agent</dt>
            <dd>
              {preview.readiness.displayName} {preview.readiness.version ?? '(version unknown)'}
            </dd>
            <dt>Executable</dt>
            <dd className="mono" title={preview.readiness.resolvedExecutable ?? ''}>
              {abbreviate(preview.readiness.resolvedExecutable)}
            </dd>
            <dt>Authentication</dt>
            <dd>{preview.readiness.authentication}</dd>
            <dt>Effective folder</dt>
            <dd className="mono">{preview.workspace.displayPath}</dd>
            {preview.workspace.displayPath !== preview.workspace.selectedPath ? (
              <>
                <dt>Selected as</dt>
                <dd className="mono">{preview.workspace.selectedPath}</dd>
              </>
            ) : null}
            <dt>Terminal</dt>
            <dd>
              {preview.terminal.columns}×{preview.terminal.rows}
            </dd>
          </dl>
          <p id="launch-boundary" className="notice warning">
            {preview.boundaryWarning}
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            I understand ThreadHelm cannot confine this agent to the folder.
          </label>
        </>
      ) : error ? null : (
        <p>Checking the folder and agent…</p>
      )}
      <LaunchError error={error} />
      <div className="actions">
        <button type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => void launch()}
          disabled={!preview || !confirmed || busy}
        >
          Launch session
        </button>
      </div>
    </Modal>
  );
}
