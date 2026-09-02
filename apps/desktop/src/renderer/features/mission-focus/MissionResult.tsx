import type { MissionPresentation } from './mission-presentation.js';

export function MissionResult({ result }: { result: MissionPresentation['verifiedResult'] }) {
  return (
    <section className="mission-result" aria-labelledby="mission-result-heading">
      <h2 id="mission-result-heading">Latest verified result</h2>
      {result ? (
        <>
          <p>{result.explanation}</p>
          <p className="mission-evidence">Evidence: {result.evidence.join(', ')}</p>
        </>
      ) : (
        <p>No verified result has been retained yet.</p>
      )}
    </section>
  );
}
