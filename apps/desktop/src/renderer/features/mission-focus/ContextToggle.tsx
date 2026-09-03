import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { MissionAttention } from './mission-presentation.js';

export function ContextToggle({
  label,
  attention,
  children,
}: {
  label: string;
  attention: MissionAttention;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => button.current?.focus());
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <div className="context-toggle">
      <button
        ref={button}
        type="button"
        className="small"
        aria-expanded={open}
        aria-controls="mission-context-overlay"
        data-attention={attention}
        onClick={() => setOpen((value) => !value)}
      >
        {attention !== 'none' ? <span className="attention-dot" aria-hidden="true" /> : null}
        {label}
      </button>
      {open ? (
        <div
          id="mission-context-overlay"
          className="context-overlay"
          role="dialog"
          aria-modal="false"
          aria-label="Mission context"
        >
          <button type="button" className="small context-overlay-close" onClick={close}>
            Close
          </button>
          {children}
        </div>
      ) : null}
    </div>
  );
}
