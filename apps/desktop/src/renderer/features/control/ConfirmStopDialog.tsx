import type { StopDisclosureView } from '@threadhelm/contracts';
import { Modal } from './Modal.js';

interface Props {
  disclosure: StopDisclosureView;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmStopDialog({ disclosure, onConfirm, onCancel }: Props) {
  return (
    <Modal title="Stop this session?" onCancel={onCancel} describedBy="stop-detail">
      <dl className="facts" id="stop-detail">
        <dt>Agent</dt>
        <dd>{disclosure.providerDisplayName}</dd>
        <dt>Folder</dt>
        <dd className="mono">{disclosure.workspaceDisplayPath}</dd>
        <dt>Session</dt>
        <dd className="mono">{disclosure.sessionId.slice(0, 8)}</dd>
      </dl>
      <p>
        New input is blocked immediately. ThreadHelm asks the agent to exit cleanly, drains its
        output, and waits up to {Math.round(disclosure.graceMs / 1000)} seconds. If it does not
        exit, force stop is offered as a separate step.
      </p>
      <div className="actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="primary" onClick={onConfirm}>
          Stop session
        </button>
      </div>
    </Modal>
  );
}
