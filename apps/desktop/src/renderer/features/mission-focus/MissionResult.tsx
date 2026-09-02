import type { MissionPresentation } from './mission-presentation.js';

export function MissionResult({
  result,
  onOpenDetail,
}: {
  result: NonNullable<MissionPresentation['verifiedResult']>;
  onOpenDetail(): void;
}) {
  return (
    <section className="mission-result" aria-labelledby="mission-result-heading">
      <h2 id="mission-result-heading">Latest verified result</h2>
      <p>{result.explanation}</p>
      <p className="mission-evidence">Evidence: {result.evidence.join(', ')}</p>
      <button type="button" className="small" onClick={onOpenDetail}>
        Open evidence…
      </button>
    </section>
  );
}
