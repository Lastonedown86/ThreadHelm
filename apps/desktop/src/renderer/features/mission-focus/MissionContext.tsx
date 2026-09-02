import type { MissionDetailView } from '@threadhelm/contracts';
import type { MissionPresentation } from './mission-presentation.js';

export function MissionContext({
  detail,
  presentation,
}: {
  detail: MissionDetailView | null;
  presentation: MissionPresentation | null;
}) {
  return (
    <div className="mission-context-content">
      <h2>Mission context</h2>
      <section>
        <span className="context-label">Attention</span>
        <strong>{presentation?.attentionLabel ?? 'None'}</strong>
      </section>
      <section>
        <span className="context-label">Crew</span>
        <strong>{detail?.envelope?.bindings.length ?? 0} bound profiles</strong>
        <p>{detail?.activeWorkerCount ?? 0} active workers</p>
      </section>
      <section>
        <span className="context-label">Authority</span>
        <p>Local coordinator · sole writer</p>
        <p>External actions · approval required</p>
      </section>
    </div>
  );
}
