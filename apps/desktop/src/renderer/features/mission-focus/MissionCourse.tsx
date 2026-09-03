import type { CourseNode, CourseNodeState } from './mission-presentation.js';

const stateLabel: Record<CourseNodeState, string> = {
  verified: 'Verified',
  current: 'In focus',
  queued: 'Queued',
  waiting: 'Waiting for you',
  uncertain: 'Uncertain',
  held: 'Held',
};

const stateGlyph: Record<CourseNodeState, string | null> = {
  verified: '✓',
  current: null,
  queued: null,
  waiting: '❚❚',
  uncertain: '?',
  held: '–',
};

export function MissionCourse({
  course,
  onOpenDetail,
  onOpenTerminal,
}: {
  course: CourseNode[];
  onOpenDetail(): void;
  onOpenTerminal(sessionId: string): void;
}) {
  return (
    <section className="mission-course" aria-labelledby="mission-course-heading">
      <div className="mission-course-header">
        <h2 id="mission-course-heading">Mission course</h2>
        <button type="button" className="small" onClick={onOpenDetail}>
          View full history…
        </button>
      </div>
      {course.length === 0 ? <p>No work has been decomposed yet.</p> : null}
      <ol className="mission-course-line" aria-label="Mission course">
        {course.map((node) => (
          <li key={node.id} className="course-node" data-state={node.state}>
            <span className="node-mark" aria-hidden="true">
              {stateGlyph[node.state] ?? node.index}
            </span>
            <span className="course-state">{stateLabel[node.state]}</span>
            <strong>{node.title}</strong>
            <p>{node.summary}</p>
            {node.action ? (
              <button
                type="button"
                className="small"
                onClick={() =>
                  node.action!.kind === 'open_terminal'
                    ? onOpenTerminal(node.action!.sessionId)
                    : onOpenDetail()
                }
              >
                {node.action.label}
              </button>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
