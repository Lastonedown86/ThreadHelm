/**
 * Close is blocked while sessions are active (FR-026). The only choices are
 * cancelling the close or stopping every session through the safe-stop flow.
 */

import { useState } from 'react';
import type { SessionView } from '@threadhelm/contracts';
import { api, call } from '../../api.js';
import { describeError } from '../launch/LaunchErrors.js';
import { Modal } from './Modal.js';

interface Props {
  sessions: SessionView[];
  onDismiss: () => void;
}

export function CloseBlockedDialog({ sessions, onDismiss }: Props) {
  const [status, setStatus] = useState<string | null>(null);

  const stopAll = async () => {
    setStatus('Stopping all sessions…');
    try {
      const result = await call(api.application.stopAllAndClose(undefined));
      if (!result.closing) {
        setStatus(
          `${result.activeSessions.length} session(s) did not stop cleanly. Force stop them individually, then close again.`,
        );
      }
    } catch (error) {
      setStatus(describeError(error));
    }
  };

  return (
    <Modal title="Sessions are still active" onCancel={onDismiss}>
      <p>ThreadHelm will not close while these sessions are running:</p>
      <ul className="list">
        {sessions.map((session) => (
          <li key={session.id}>
            <strong>{session.providerDisplayName}</strong>{' '}
            <span className="mono">{session.workspaceDisplayPath}</span> — {session.lifecycleState}
          </li>
        ))}
      </ul>
      {status ? (
        <p className="notice" aria-live="polite">
          {status}
        </p>
      ) : null}
      <div className="actions">
        <button type="button" onClick={onDismiss}>
          Cancel closing
        </button>
        <button type="button" className="danger" onClick={() => void stopAll()}>
          Stop all sessions and exit
        </button>
      </div>
    </Modal>
  );
}
