import type { MissionDetailView, SessionView } from '@threadhelm/contracts';
import { useStore } from '../../store.js';
import type { ActionKind, MissionPresentation } from './mission-presentation.js';

const roleLabel: Record<string, string> = {
  supervisor: 'Supervisor',
  worker: 'Worker',
  reviewer: 'Reviewer',
  triage: 'Triage',
};

function crewState(session: SessionView | undefined): string {
  if (!session) return 'not running';
  switch (session.lifecycleState) {
    case 'running':
      return 'working';
    case 'starting':
      return 'starting';
    case 'interrupting':
    case 'stopping':
      return 'stopping';
    case 'stopped':
      return 'stopped';
    case 'failed':
      return 'failed';
    case 'recovery_required':
      return 'recovery required';
  }
}

export function MissionContext({
  detail,
  presentation,
  onAction,
  onOpenAttention,
}: {
  detail: MissionDetailView | null;
  presentation: MissionPresentation | null;
  onAction(kind: ActionKind): void;
  onOpenAttention(): void;
}) {
  const { state } = useStore();
  const bindings = detail?.envelope?.bindings ?? [];
  return (
    <div className="mission-context-content">
      <h2>Mission context</h2>
      {presentation && presentation.attention !== 'none' ? (
        <section className="mission-decision" data-attention={presentation.attention}>
          <span className="context-label">{presentation.attentionLabel}</span>
          <strong>{presentation.attentionSummary}</strong>
          {presentation.attention === 'recovery' ? (
            <button type="button" className="primary" onClick={onOpenAttention}>
              Open attention queue
            </button>
          ) : presentation.primaryAction ? (
            <button
              type="button"
              className="primary"
              onClick={() => onAction(presentation.primaryAction!.kind)}
            >
              {presentation.primaryAction.label}
            </button>
          ) : null}
        </section>
      ) : null}
      <section>
        <span className="context-label">Crew</span>
        {bindings.length === 0 ? (
          <p>No crew is bound.</p>
        ) : (
          <ul className="mission-crew" aria-label="Crew">
            {bindings.map((binding) => {
              const session = binding.sessionId ? state.sessions[binding.sessionId] : undefined;
              return (
                <li key={binding.bindingId}>
                  <span className="crew-mark" aria-hidden="true">
                    {(roleLabel[binding.role] ?? binding.role).charAt(0)}
                  </span>
                  <span>
                    <strong>{roleLabel[binding.role] ?? binding.role}</strong>
                    <small>{session?.providerDisplayName ?? binding.providerId}</small>
                  </span>
                  <em>{crewState(session)}</em>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section>
        <span className="context-label">Authority</span>
        <p>Local coordinator · sole writer</p>
        <p>External actions · approval required</p>
      </section>
    </div>
  );
}
