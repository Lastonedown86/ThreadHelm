import type { MissionDetailView } from '@threadhelm/contracts';
import { useStore } from '../../store.js';
import { LIFECYCLE_LABEL } from '../sessions/SessionList.js';

const roleLabel: Record<string, string> = {
  supervisor: 'Supervisor',
  worker: 'Worker',
  reviewer: 'Reviewer',
  triage: 'Triage',
};

export function MissionSessionSummary({ detail }: { detail: MissionDetailView }) {
  const { state, actions } = useStore();
  const seen = new Set<string>();
  const bound = (detail.envelope?.bindings ?? []).filter((binding) => {
    if (!binding.sessionId || seen.has(binding.sessionId)) return false;
    seen.add(binding.sessionId);
    return true;
  });
  return (
    <section className="mission-session-summary" aria-labelledby="mission-sessions-heading">
      <h2 id="mission-sessions-heading">Attached sessions</h2>
      {bound.length === 0 ? (
        <p>No bound session is attached.</p>
      ) : (
        <ul className="mission-session-rows">
          {bound.map((binding) => {
            const sessionId = binding.sessionId!;
            const session = state.sessions[sessionId];
            return (
              <li key={binding.bindingId}>
                <span className="badge">{roleLabel[binding.role] ?? binding.role}</span>
                <span>
                  {session?.providerDisplayName ?? binding.providerId} ·{' '}
                  <span className="mono">{binding.displayPath}</span>
                  {session ? ` · ${LIFECYCLE_LABEL[session.lifecycleState]}` : ' · not running'}
                </span>
                <button
                  type="button"
                  className="small"
                  disabled={!session}
                  onClick={() => {
                    actions.select(sessionId);
                    actions.selectDestination('sessions');
                  }}
                >
                  Open terminal
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
