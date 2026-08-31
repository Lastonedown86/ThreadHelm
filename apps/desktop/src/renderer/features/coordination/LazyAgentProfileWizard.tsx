import { useEffect, useState, type ComponentProps } from 'react';
import type { AgentProfileWizard } from './AgentProfileWizard.js';
import { ModalDialog } from './ModalDialog.js';

export function LazyAgentProfileWizard(props: ComponentProps<typeof AgentProfileWizard>) {
  const [Wizard, setWizard] = useState<typeof AgentProfileWizard | null>(null);
  const [failed, setFailed] = useState(false);
  // Capture before the loading dialog focuses its cancel button. Both dialogs
  // can then come and go without losing the original keyboard return target.
  const [opener] = useState(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  useEffect(() => {
    let cancelled = false;
    void import('./AgentProfileWizard.js').then(
      (module) => {
        if (!cancelled) setWizard(() => module.AgentProfileWizard);
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
      queueMicrotask(() => {
        if (opener?.isConnected && !document.querySelector('dialog[open]')) opener.focus();
      });
    };
  }, [opener]);
  if (Wizard) return <Wizard {...props} />;
  return (
    <ModalDialog label="Create agent" onDismiss={props.onClose}>
      <h3>Create agent</h3>
      <p className={failed ? 'notice error' : 'hint'} role="status">
        {failed
          ? 'The agent editor could not load. Your saved drafts have not changed. Close and try again.'
          : 'Loading agent editor…'}
      </p>
      <button type="button" onClick={props.onClose}>
        {failed ? 'Close' : 'Cancel'}
      </button>
    </ModalDialog>
  );
}
