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
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    const first = dialog.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    first?.focus();
    return () => {
      // React removes the dialog before passive cleanup; native close alone
      // then cannot restore focus. Do not steal focus from a replacement dialog.
      if (dialog.open) dialog.close();
      queueMicrotask(() => {
        if (opener?.isConnected && !document.querySelector('dialog[open]')) opener.focus();
      });
    };
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
