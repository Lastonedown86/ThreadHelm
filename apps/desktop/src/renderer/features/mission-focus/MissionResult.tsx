import type { MissionDetailView } from '@threadhelm/contracts';

export function MissionResult({ detail }: { detail: MissionDetailView }) {
  const latest = [...detail.attempts]
    .filter((attempt) => attempt.state === 'completed' && attempt.evidenceRefs.length > 0)
    .sort((left, right) => (right.completedAt ?? '').localeCompare(left.completedAt ?? ''))[0];
  return (
    <section className="mission-result" aria-labelledby="mission-result-heading">
      <h2 id="mission-result-heading">Latest verified result</h2>
      {latest ? (
        <>
          <p>{latest.explanation ?? 'Completed work retained evidence.'}</p>
          <p className="mission-evidence">
            Evidence:{' '}
            {latest.evidenceRefs
              .map((reference) => `${reference.kind} · ${reference.id}`)
              .join(', ')}
          </p>
        </>
      ) : (
        <p>No verified result has been retained yet.</p>
      )}
    </section>
  );
}
