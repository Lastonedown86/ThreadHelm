import { useEffect, useRef, type ReactNode } from 'react';

export function ModalDialog({
  label,
  onDismiss,
  children,
}: {
  label: string;
  onDismiss(): void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    const first = dialog.querySelector<HTMLElement>(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])',
    );
    first?.focus();
    return () => {
      if (dialog.open) dialog.close();
      // React removes the dialog before passive cleanup; native close alone then
      // cannot restore focus. Do not steal focus from a replacement dialog.
      queueMicrotask(() => {
        if (opener?.isConnected && !document.querySelector('dialog[open]')) opener.focus();
      });
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
    >
      {children}
    </dialog>
  );
}
