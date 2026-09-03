import { MissionContextFrame } from '../mission-focus/MissionContextFrame.js';
import { STAGE_LABEL, type Stage, type WorkerFields } from './composer-fields.js';

const REMAINING: Record<Stage, string> = {
  outcome: 'Crew, access and limits, then review remain.',
  access: 'Review remains.',
  crew: 'Access and limits, then review remain.',
  review: 'Start the mission when the review is ready.',
};

export function ComposerContext({ stage, workers }: { stage: Stage; workers: WorkerFields[] }) {
  const roles = workers.map((w) => w.role);
  return (
    <MissionContextFrame heading="Mission draft">
      <section>
        <p className="context-label">Stage</p>
        <p>{STAGE_LABEL[stage]}</p>
        <p className="hint">{REMAINING[stage]}</p>
      </section>
      <section>
        <p className="context-label">Crew</p>
        <p>
          {workers.length === 0
            ? 'No crew chosen'
            : `${workers.length} worker${workers.length === 1 ? '' : 's'} · ${[...new Set(roles)].join(', ')}`}
        </p>
      </section>
      <section>
        <p className="context-label">Still off</p>
        <ul className="list">
          <li>Break-glass bypass</li>
          <li>Parent or sibling folders</li>
          <li>Automatic startup unless chosen per worker</li>
          <li>External actions without approval</li>
        </ul>
      </section>
    </MissionContextFrame>
  );
}
