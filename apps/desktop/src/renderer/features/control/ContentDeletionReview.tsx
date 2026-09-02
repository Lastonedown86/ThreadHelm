import type { ReactNode } from 'react';
import { Modal } from './Modal.js';

export function ContentDeletionReview({
  title,
  summary,
  children,
  confirmed,
  onConfirmed,
  onCancel,
  onDelete,
}: {
  title: string;
  summary: string;
  children?: ReactNode;
  confirmed: boolean;
  onConfirmed(value: boolean): void;
  onCancel(): void;
  onDelete(): void;
}) {
  return (
    <Modal title={title} onCancel={onCancel}>
      <p>{summary}</p>
      {children}
      <p>
        Content-free lifecycle and audit receipts may remain. Active or uncertain work can block
        deletion.
      </p>
      <label className="confirmation">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => onConfirmed(event.target.checked)}
        />{' '}
        Permanently delete the named content.
      </label>
      <div className="actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="danger" disabled={!confirmed} onClick={onDelete}>
          Delete permanently
        </button>
      </div>
    </Modal>
  );
}
