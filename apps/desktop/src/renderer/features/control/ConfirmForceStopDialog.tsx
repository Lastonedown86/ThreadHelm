import type { ForceStopDisclosureView } from '@threadhelm/contracts';
import { Modal } from './Modal.js';

interface Props {
  disclosure: ForceStopDisclosureView;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmForceStopDialog({ disclosure, onConfirm, onCancel }: Props) {
  return (
    <Modal title="Force stop this session?" onCancel={onCancel} describedBy="force-detail">
      <dl className="facts" id="force-detail">
        <dt>Agent</dt>
        <dd>{disclosure.providerDisplayName}</dd>
        <dt>Folder</dt>
        <dd className="mono">{disclosure.workspaceDisplayPath}</dd>
        <dt>Session</dt>
        <dd className="mono">{disclosure.sessionId.slice(0, 8)}</dd>
        <dt>Processes</dt>
        <dd>{disclosure.processCount} in the supervised scope</dd>
      </dl>
      <p className="notice error">{disclosure.risk}</p>
      <div className="actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="danger" onClick={onConfirm}>
          Force stop now
        </button>
      </div>
    </Modal>
  );
}
