/**
 * Interrupt / Stop / Force stop for the selected session (T074). Every
 * control names its exact target; stop and force stop go through a
 * target-bound confirmation.
 */

import { useEffect, useState } from 'react';
import type {
  ForceStopDisclosureView,
  InterruptOutcome,
  SessionView,
  StopDisclosureView,
} from '@threadhelm/contracts';
import { api, call } from '../../api.js';
import { useStore } from '../../store.js';
import { describeError } from '../launch/LaunchErrors.js';
import { ConfirmForceStopDialog } from './ConfirmForceStopDialog.js';
import { ConfirmStopDialog } from './ConfirmStopDialog.js';

const INTERRUPT_LABEL: Record<InterruptOutcome, string> = {
  returned_to_interactive: 'Interrupt sent: the agent returned to an interactive state.',
  exited: 'Interrupt sent: the agent exited.',
  unresponsive: 'Interrupt sent: the agent did not respond.',
};

export function ControlBar({ session }: { session: SessionView }) {
  const { state, actions } = useStore();
  const [stop, setStop] = useState<StopDisclosureView | null>(null);
  const [force, setForce] = useState<ForceStopDisclosureView | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const lifecycle = session.lifecycleState;
  const outcome = state.interruptResults[session.id];
  // A new interrupt outcome replaces its pending request, not later stop requests.
  useEffect(() => {
    if (outcome) setStatus(null);
  }, [outcome]);
  // Observed completion replaces pending requests; selection remounts this bar.
  useEffect(() => {
    if (lifecycle === 'stopped' || lifecycle === 'failed' || lifecycle === 'recovery_required') {
      setStatus(null);
    }
  }, [lifecycle]);
  const visibleOutcome =
    lifecycle === 'running' || lifecycle === 'interrupting' || outcome === 'exited'
      ? outcome
      : undefined;

  const run = async (work: () => Promise<unknown>, pending: string) => {
    setStatus(pending);
    try {
      await work();
    } catch (error) {
      setStatus(describeError(error));
    }
  };

  const target = `${session.providerDisplayName} in ${session.workspaceDisplayPath}`;

  return (
    <div className="control-bar" role="group" aria-label={`Controls for ${target}`}>
      <button
        type="button"
        id="control-interrupt"
        data-focus-escape
        disabled={lifecycle !== 'running'}
        onClick={() =>
          void run(
            () => call(api.sessions.interrupt({ sessionId: session.id })),
            `Interrupt requested for ${target}.`,
          )
        }
      >
        Interrupt
      </button>
      <button
        type="button"
        disabled={lifecycle !== 'running' && lifecycle !== 'interrupting'}
        onClick={() =>
          void run(async () => {
            setStop(await call(api.sessions.requestStop({ sessionId: session.id })));
          }, '')
        }
      >
        Stop…
      </button>
      <button
        type="button"
        className="danger"
        disabled={!session.forceStopAvailable && lifecycle !== 'stopping'}
        onClick={() =>
          void run(async () => {
            setForce(await call(api.sessions.requestForceStop({ sessionId: session.id })));
          }, '')
        }
      >
        Force stop…
      </button>
      <span className="control-status" aria-live="polite">
        {status || (visibleOutcome ? INTERRUPT_LABEL[visibleOutcome] : '')}
      </span>
      {stop ? (
        <ConfirmStopDialog
          disclosure={stop}
          onCancel={() => setStop(null)}
          onConfirm={() =>
            void run(async () => {
              await call(api.sessions.confirmStop({ stopToken: stop.stopToken }));
              setStop(null);
            }, `Stop requested for ${target}.`).finally(() => setStop(null))
          }
        />
      ) : null}
      {force ? (
        <ConfirmForceStopDialog
          disclosure={force}
          onCancel={() => setForce(null)}
          onConfirm={() =>
            void run(async () => {
              await call(api.sessions.confirmForceStop({ forceToken: force.forceToken }));
              setForce(null);
            }, `Force stop requested for ${target}.`).finally(() => {
              setForce(null);
              actions.setNotice(null);
            })
          }
        />
      ) : null}
    </div>
  );
}
