import type { RecoveryRecordView } from '@threadhelm/contracts';

export function RecoveryCoach({ record }: { record: RecoveryRecordView }) {
  const uncertain =
    record.classification === 'observation_lost' || record.classification === 'incomplete_stop';
  return (
    <section className="recovery-coach" aria-labelledby="recovery-coach-heading">
      <p className="eyebrow">Recovery coach</p>
      <h3 id="recovery-coach-heading">Safest next step</h3>
      <p>
        {uncertain
          ? 'The prior effect is uncertain. Inspect retained evidence, then either dismiss the notice or start separately reviewed replacement work.'
          : 'Review the exact stopped session before deciding whether replacement work is needed.'}
      </p>
      <p className="hint">
        ThreadHelm never replays, resumes, or resends unknown work automatically.
      </p>
    </section>
  );
}
