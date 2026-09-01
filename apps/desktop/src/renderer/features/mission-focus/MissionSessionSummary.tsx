import type { MissionDetailView } from '@threadhelm/contracts';

export function MissionSessionSummary({ detail }: { detail: MissionDetailView }) {
  const sessions = new Set(
    detail.envelope?.bindings.flatMap((binding) =>
      binding.sessionId ? [binding.sessionId] : [],
    ) ?? [],
  );
  return (
    <section className="mission-session-summary" aria-labelledby="mission-sessions-heading">
      <h2 id="mission-sessions-heading">Attached sessions</h2>
      <p>
        {sessions.size === 0
          ? 'No bound session is attached.'
          : `${sessions.size} exact bound session${sessions.size === 1 ? '' : 's'}.`}
      </p>
    </section>
  );
}
