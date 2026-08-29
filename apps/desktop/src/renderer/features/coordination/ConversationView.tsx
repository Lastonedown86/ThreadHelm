import { useEffect, useState } from 'react';
import type {
  ConversationDetailView,
  ConversationState,
  ConversationSummaryView,
  DeliveryState,
  WorkOutcome,
} from '@threadhelm/contracts';
import { api, call } from '../../api.js';
import { useStore } from '../../store.js';
import { DeleteConversationDialog } from './HandoffDisclosures.js';

const TRANSPORT_LABEL: Record<DeliveryState, string> = {
  queued: 'Transport: Queued',
  held: 'Transport: Held',
  manual_actionable: 'Transport: Manual Action Required',
  presenting: 'Transport: Presenting',
  delivered: 'Transport: Delivered',
  acknowledged: 'Transport: Acknowledged',
  failed: 'Transport: Failed',
  cancelled: 'Transport: Cancelled',
};

const OUTCOME_LABEL: Record<WorkOutcome, string> = {
  pending: 'Outcome: Pending',
  completed: 'Outcome: Completed',
  refused: 'Outcome: Refused',
  failed: 'Outcome: Failed',
  escalated: 'Outcome: Escalated',
  cancelled: 'Outcome: Cancelled',
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function ConversationView() {
  const { state } = useStore();
  const [conversations, setConversations] = useState<ConversationSummaryView[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetailView | null>(null);
  const [filterState, setFilterState] = useState<ConversationState | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await call(
        api.coordination.listConversations(filterState === 'all' ? {} : { state: filterState }),
      );
      setConversations(resp.conversations);
      setSelectedConversationId((current) =>
        current && resp.conversations.some((conversation) => conversation.id === current)
          ? current
          : null,
      );
    } catch (err) {
      setError(errorMessage(err, 'Failed to load conversations.'));
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (conversationId: string) => {
    try {
      const resp = await call(api.coordination.getConversation({ conversationId }));
      setDetail(resp);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load conversation details.'));
    }
  };

  useEffect(() => {
    void fetchList();
  }, [filterState]);

  useEffect(() => {
    if (selectedConversationId) {
      void fetchDetail(selectedConversationId);
    } else {
      setDetail(null);
    }
  }, [selectedConversationId]);

  const pause = async () => {
    if (!selectedConversationId) return;
    try {
      await call(api.coordination.pauseConversation({ conversationId: selectedConversationId }));
      void fetchList();
      void fetchDetail(selectedConversationId);
    } catch (err) {
      setError(errorMessage(err, 'Failed to pause conversation.'));
    }
  };

  return (
    <section className="panel conversation-view" aria-labelledby="conversations-heading">
      <div className="panel-heading">
        <h2 id="conversations-heading">Agent conversations</h2>
        <div className="filter-controls">
          <label htmlFor="conversation-filter">State filter: </label>
          <select
            id="conversation-filter"
            value={filterState}
            onChange={(e) => setFilterState(e.target.value as ConversationState | 'all')}
          >
            <option value="all">All states</option>
            <option value="open">Open</option>
            <option value="paused">Paused</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <button type="button" className="small" onClick={() => void fetchList()}>
            Refresh
          </button>
        </div>
      </div>

      {error ? <p className="notice error">{error}</p> : null}

      <div className="conversation-split-view">
        <div className="conversation-list-col">
          <h3>Conversations ({conversations.length})</h3>
          {conversations.length === 0 && !loading ? (
            <p className="hint">No conversations match the current filter.</p>
          ) : null}
          <ul className="list conversations" aria-label="Conversation list">
            {conversations.map((c) => {
              const isSelected = c.id === selectedConversationId;
              return (
                <li
                  key={c.id}
                  className={`conversation-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedConversationId(c.id)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setSelectedConversationId(c.id);
                    }
                  }}
                >
                  <div className="conversation-header">
                    <strong>{c.id.slice(0, 8)}</strong>
                    <span className={`badge state-${c.state}`}>{c.state}</span>
                  </div>
                  <div className="hint">
                    Handoffs: {c.handoffCount} · Unresolved: {c.unresolvedCount}
                  </div>
                  <div className="hint time">{new Date(c.updatedAt).toLocaleTimeString()}</div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="conversation-detail-col" role="region" aria-label="Conversation detail">
          {detail ? (
            <div className="detail-container">
              <div className="detail-header">
                <h3>Conversation {detail.summary.id.slice(0, 8)}</h3>
                <div className="header-actions">
                  {detail.summary.state === 'open' ? (
                    <button type="button" className="small warning" onClick={() => void pause()}>
                      Pause conversation
                    </button>
                  ) : null}
                  {detail.summary.state === 'resolved' || detail.summary.state === 'closed' ? (
                    <button
                      type="button"
                      className="small danger"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      Delete content…
                    </button>
                  ) : null}
                </div>
              </div>

              <dl className="facts inline-facts">
                <dt>State</dt>
                <dd className={`badge state-${detail.summary.state}`}>{detail.summary.state}</dd>
                <dt>Participants</dt>
                <dd>
                  {detail.summary.participantSessionIds
                    .map((id) => state.sessions[id]?.providerDisplayName ?? id.slice(0, 8))
                    .join(' ↔ ')}
                </dd>
                {detail.summary.pauseReasonCode ? (
                  <>
                    <dt>Pause reason</dt>
                    <dd>{detail.summary.pauseReasonCode}</dd>
                  </>
                ) : null}
                {detail.summary.contentDeletedAt ? (
                  <>
                    <dt>Content status</dt>
                    <dd className="badge danger">Content deleted</dd>
                  </>
                ) : null}
              </dl>

              <h4>Attributed message timeline ({detail.handoffs.length})</h4>
              <ul className="timeline-list" aria-label="Conversation message timeline">
                {detail.handoffs.map((h) => {
                  const sender =
                    state.sessions[h.senderSessionId]?.providerDisplayName ??
                    h.senderSessionId.slice(0, 8);
                  const recipient =
                    state.sessions[h.recipientSessionId]?.providerDisplayName ??
                    h.recipientSessionId.slice(0, 8);
                  return (
                    <li key={h.id} className="timeline-entry" data-handoff-id={h.id}>
                      <div className="timeline-meta">
                        <span className="sender">{sender}</span> →{' '}
                        <span className="recipient">{recipient}</span>
                        <span className="kind-badge">{h.kind}</span>
                        <span className="time">{new Date(h.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <div className="timeline-status-badges">
                        <span className={`badge delivery-${h.deliveryState}`}>
                          {TRANSPORT_LABEL[h.deliveryState]}
                        </span>
                        <span className={`badge outcome-${h.workOutcome}`}>
                          {OUTCOME_LABEL[h.workOutcome]}
                        </span>
                        {h.holdReasonCode ? (
                          <span className="badge warning">Hold: {h.holdReasonCode}</span>
                        ) : null}
                      </div>
                      {h.purpose || h.body ? (
                        <div className="timeline-body">
                          {h.purpose ? <h5>{h.purpose}</h5> : null}
                          {h.body ? <pre className="message-content">{h.body}</pre> : null}
                        </div>
                      ) : (
                        <div className="timeline-body deleted">
                          <em>[Content deleted by user policy]</em>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="hint select-prompt">
              Select a conversation to view its attributed timeline.
            </p>
          )}
        </div>
      </div>

      {deleteDialogOpen && selectedConversationId ? (
        <DeleteConversationDialog
          conversationId={selectedConversationId}
          onComplete={() => {
            setDeleteDialogOpen(false);
            void fetchList();
            void fetchDetail(selectedConversationId);
          }}
          onCancel={() => setDeleteDialogOpen(false)}
        />
      ) : null}
    </section>
  );
}
