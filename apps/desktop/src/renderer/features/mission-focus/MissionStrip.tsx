import type { MissionPresentation } from './mission-presentation.js';

export function MissionStrip({
  strip,
  state,
}: {
  strip: MissionPresentation['strip'];
  state: string;
}) {
  const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;
  return (
    <ul className="mission-strip" aria-label="Mission status">
      <li>
        <span className="mission-state-shape" data-state={state} aria-hidden="true" />
        {strip.execution}
      </li>
      <li>{plural(strip.decisionsPending, 'decision')} pending</li>
      <li>{plural(strip.sessionsAttached, 'session')} attached</li>
    </ul>
  );
}
