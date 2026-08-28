/**
 * Workspace approval (T046). Choose through the native picker, review the
 * effective identity, approve explicitly; revoke when no session is active.
 */

import { useState } from 'react';
import type { WorkspaceCandidateView } from '@threadhelm/contracts';
import { api, call, errorCode } from '../../api.js';
import { useStore } from '../../store.js';
import { Modal } from '../control/Modal.js';
import { describeError, LaunchError } from '../launch/LaunchErrors.js';

export function WorkspacePanel() {
  const { state, actions } = useStore();
  const [candidate, setCandidate] = useState<WorkspaceCandidateView | null>(null);
  const [error, setError] = useState<unknown>(null);

  const choose = async () => {
    setError(null);
    try {
      setCandidate(await call(api.workspaces.choose(undefined)));
    } catch (err) {
      if (errorCode(err) !== 'SELECTION_CANCELLED') setError(err);
    }
  };

  const approve = async () => {
    if (!candidate) return;
    try {
      const workspace = await call(
        api.workspaces.approve({ candidateToken: candidate.candidateToken }),
      );
      actions.workspaceChanged(workspace);
      setCandidate(null);
    } catch (err) {
      setError(err);
      setCandidate(null);
    }
  };

  const revoke = async (workspaceId: string) => {
    setError(null);
    try {
      actions.workspaceChanged(await call(api.workspaces.revoke({ workspaceId })));
    } catch (err) {
      actions.setNotice(describeError(err));
    }
  };

  const active = state.workspaces.filter((workspace) => workspace.revokedAt === null);

  return (
    <section className="panel" aria-labelledby="workspaces-heading">
      <h2 id="workspaces-heading">Approved workspaces</h2>
      <button type="button" onClick={() => void choose()}>
        Choose folder…
      </button>
      <LaunchError error={error} />
      {active.length === 0 ? <p className="hint">No folder approved yet.</p> : null}
      <ul className="list">
        {active.map((workspace) => (
          <li key={workspace.id}>
            <div className="mono">{workspace.displayPath}</div>
            {workspace.selectedPath !== workspace.displayPath ? (
              <div className="hint">
                selected as <span className="mono">{workspace.selectedPath}</span>
              </div>
            ) : null}
            <div className="hint">approved {new Date(workspace.approvedAt).toLocaleString()}</div>
            <button
              type="button"
              className="small"
              onClick={() => void revoke(workspace.id)}
              aria-label={`Revoke approval for ${workspace.displayPath}`}
            >
              Revoke
            </button>
          </li>
        ))}
      </ul>
      {candidate ? (
        <Modal title="Approve this folder?" onCancel={() => setCandidate(null)}>
          <dl className="facts">
            <dt>Selected</dt>
            <dd className="mono">{candidate.selectedPath}</dd>
            <dt>Effective folder</dt>
            <dd className="mono">{candidate.displayPath}</dd>
            <dt>Identity</dt>
            <dd className="mono">
              volume {candidate.identity.volumeSerial} · file{' '}
              {candidate.identity.fileId.slice(0, 16)}…
            </dd>
            <dt>Volume</dt>
            <dd>fixed local drive</dd>
          </dl>
          {candidate.isReparsePoint ? (
            <p className="notice warning">
              The selected path is a junction or link. Approval applies to the effective folder
              shown above.
            </p>
          ) : null}
          {candidate.existingWorkspaceId ? (
            <p className="notice">
              This effective folder is already approved; approving again keeps one record.
            </p>
          ) : null}
          <p>
            Approval lets you launch agents with this folder as their working directory. It does not
            confine an agent to it.
          </p>
          <div className="actions">
            <button type="button" onClick={() => setCandidate(null)}>
              Cancel
            </button>
            <button type="button" className="primary" onClick={() => void approve()}>
              Approve folder
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
