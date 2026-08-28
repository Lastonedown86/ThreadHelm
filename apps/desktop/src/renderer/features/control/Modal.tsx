/**
 * Native <dialog> modal: browser-provided focus trap, Escape → cancel,
 * aria-modal semantics for free.
 */

import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  title: string;
  onCancel: () => void;
  children: ReactNode;
  describedBy?: string;
}

export function Modal({ title, onCancel, children, describedBy }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    const first = dialog.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    first?.focus();
  }, []);

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      aria-describedby={describedBy}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <h2 id="modal-title">{title}</h2>
      {children}
    </dialog>
  );
}
