import type { MissionPresentation } from './mission-presentation.js';

export function MissionCourse({ course }: { course: MissionPresentation['course'] }) {
  return (
    <section className="mission-course" aria-labelledby="mission-course-heading">
      <h2 id="mission-course-heading">Mission course</h2>
      {course.length === 0 ? <p>No work has been decomposed yet.</p> : null}
      <ol>
        {course.map((node) => (
          <li key={node.id} data-state={node.state}>
            <span className="course-state">{node.state}</span>
            <strong>{node.title}</strong>
            <p>{node.summary}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
