import type { MissionDetailView } from '@threadhelm/contracts';
import type { MissionPresentation } from './mission-presentation.js';

// The strip's text already resolves attention over raw lifecycle (e.g. a running mission
// with a pending decision reads "Waiting for your decision"); the shape must follow the
// same override, or it shows a lifecycle shape (running/paused) beside attention text.
const AMBIGUOUS_EXECUTION = new Set(['Waiting for your decision', 'Held with uncertain outcome']);

export function MissionStrip({
  strip,
  state,
}: {
  strip: MissionPresentation['strip'];
  state: MissionDetailView['state'];
}) {
  const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;
  const shapeState = AMBIGUOUS_EXECUTION.has(strip.execution) ? undefined : state;
  return (
    <ul className="mission-strip" aria-label="Mission status">
      <li>
        <span className="mission-state-shape" data-state={shapeState} aria-hidden="true" />
        {strip.execution}
      </li>
      <li>{plural(strip.decisionsPending, 'decision')} pending</li>
      <li>{plural(strip.sessionsAttached, 'session')} attached</li>
    </ul>
  );
}
