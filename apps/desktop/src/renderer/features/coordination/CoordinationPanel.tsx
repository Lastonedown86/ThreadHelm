import { useState } from 'react';
import type { DeliveryAttemptView, DeliveryState, HandoffSummaryView } from '@threadhelm/contracts';
import { useStore } from '../../store.js';
import { HandoffComposer } from './HandoffComposer.js';
import { CancelHandoffDialog, PresentationDialog, RetargetDialog } from './HandoffDisclosures.js';

const STATE_LABEL: Record<DeliveryState, string> = {
  queued: 'Queued — not delivered',
  held: 'Held',
  manual_actionable: 'Manual action required',
  presenting: 'Presentation in progress',
  delivered: 'Delivered — outcome pending',
  acknowledged: 'Acknowledged — outcome pending',
  failed: 'Delivery failed',
  cancelled: 'Cancelled',
};

type Dialog =
  | { kind: 'compose' }
  | { kind: 'present'; handoff: HandoffSummaryView }
  | { kind: 'retarget'; handoff: HandoffSummaryView }
  | { kind: 'cancel'; handoff: HandoffSummaryView }
  | null;

export function CoordinationPanel() {
  const { state, actions } = useStore();
  const [dialog, setDialog] = useState<Dialog>(null);
  const sessions = state.sessionOrder.map((id) => state.sessions[id]!).filter(Boolean);
  const handoffs = state.coordinationOrder
    .map((id) => state.coordinationHandoffs[id])
    .filter((handoff): handoff is HandoffSummaryView => Boolean(handoff));

  const saved = (handoff: HandoffSummaryView) => {
    actions.handoffChanged(handoff);
    setDialog(null);
  };
  const presented = (attempt: DeliveryAttemptView) => {
    actions.setNotice(
      attempt.state === 'applied'
        ? 'Handoff was presented once. Delivery does not mean the requested work is complete.'
        : attempt.state === 'unknown'
          ? 'Delivery is unknown. ThreadHelm will not retry automatically.'
          : 'The handoff was not written. Review the recipient before trying again.',
    );
    setDialog(null);
    void actions.refreshCoordination();
  };

  return (
    <section className="panel coordination" aria-labelledby="coordination-heading">
      <div className="panel-heading">
        <h2 id="coordination-heading">Directed handoffs</h2>
        <button
          type="button"
          className="small"
          disabled={sessions.length < 2 || state.storageDegraded}
          onClick={() => setDialog({ kind: 'compose' })}
        >
          New handoff…
        </button>
      </div>
      {sessions.length < 2 ? (
        <p className="hint">Launch two sessions to create a one-recipient handoff.</p>
      ) : null}
      {state.coordinationNotice ? (
        <p className="hint" aria-live="polite">
          {state.coordinationNotice}
        </p>
      ) : null}
      {handoffs.length === 0 ? <p className="hint">No handoffs yet.</p> : null}
      <ul className="list handoffs" aria-label="Directed handoffs">
        {handoffs.map((handoff) => {
          const source = state.sessions[handoff.senderSessionId];
          const recipient = state.sessions[handoff.recipientSessionId];
          const editable = ['queued', 'held', 'manual_actionable', 'failed'].includes(
            handoff.deliveryState,
          );
          const selected = state.selectedSessionId === handoff.recipientSessionId;
          return (
            <li key={handoff.id} data-handoff-id={handoff.id}>
              <strong>
                {handoff.kind} · {handoff.id.slice(0, 8)}
              </strong>
              <div className="hint">
                {source?.providerDisplayName ?? 'Unknown source'} →{' '}
                {recipient?.providerDisplayName ?? 'Unknown recipient'}
              </div>
              <div>
                <span className={`badge delivery-${handoff.deliveryState}`}>
                  {STATE_LABEL[handoff.deliveryState]}
                </span>{' '}
                <span className="hint">
                  {handoff.responseExpected ? 'response expected' : 'informational'}
                </span>
              </div>
              {editable ? (
                <div className="actions inline">
                  <button
                    type="button"
                    className="small"
                    disabled={!selected || recipient?.lifecycleState !== 'running'}
                    aria-describedby={!selected ? `select-recipient-${handoff.id}` : undefined}
                    onClick={() => setDialog({ kind: 'present', handoff })}
                  >
                    Present…
                  </button>
                  <button
                    type="button"
                    className="small"
                    disabled={sessions.length < 3}
                    onClick={() => setDialog({ kind: 'retarget', handoff })}
                  >
                    Retarget…
                  </button>
                  <button
                    type="button"
                    className="small"
                    onClick={() => setDialog({ kind: 'cancel', handoff })}
                  >
                    Cancel…
                  </button>
                </div>
              ) : null}
              {!selected && editable ? (
                <p className="hint" id={`select-recipient-${handoff.id}`}>
                  Select the exact recipient session before manual presentation.
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {dialog?.kind === 'compose' ? (
        <HandoffComposer
          sessions={sessions}
          selectedSessionId={state.selectedSessionId}
          onSaved={saved}
          onCancel={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'present' ? (
        <PresentationDialog
          handoff={dialog.handoff}
          sessions={state.sessions}
          onComplete={presented}
          onCancel={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'retarget' ? (
        <RetargetDialog
          handoff={dialog.handoff}
          sessions={sessions}
          onSaved={saved}
          onCancel={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === 'cancel' ? (
        <CancelHandoffDialog
          handoff={dialog.handoff}
          onSaved={saved}
          onCancel={() => setDialog(null)}
        />
      ) : null}
    </section>
  );
}
