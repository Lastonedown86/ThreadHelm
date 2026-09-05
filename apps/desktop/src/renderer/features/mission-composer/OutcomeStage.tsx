import { useId } from 'react';
import type { MissionComposerFields } from '@threadhelm/contracts';
import { ListEditor } from './ListEditor.js';

export interface StageProps {
  fields: MissionComposerFields;
  setFields(patch: Partial<MissionComposerFields>): void;
  invalid: string | null;
}

export function OutcomeStage({ fields, setFields, invalid }: StageProps) {
  const objectiveId = useId();
  const objectiveHintId = useId();
  const evidenceId = useId();
  const evidenceHintId = useId();
  return (
    <div className="composer-stage-body">
      <div className="field">
        <label htmlFor={objectiveId}>Finish line</label>
        <span className="hint" id={objectiveHintId}>
          One sentence a coordinator can check. Keep it narrow enough that everyone recognizes done.
        </span>
        <textarea
          id={objectiveId}
          rows={3}
          maxLength={4000}
          value={fields.objective ?? ''}
          aria-describedby={objectiveHintId}
          aria-invalid={invalid === 'objective' || undefined}
          data-field="objective"
          onChange={(event) => setFields({ objective: event.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor={evidenceId}>Proof of completion</label>
        <span className="hint" id={evidenceHintId}>
          What evidence shows the finish line was reached.
        </span>
        <textarea
          id={evidenceId}
          rows={2}
          maxLength={2000}
          value={fields.completionEvidence ?? ''}
          aria-describedby={evidenceHintId}
          aria-invalid={invalid === 'completionEvidence' || undefined}
          data-field="completionEvidence"
          onChange={(event) => setFields({ completionEvidence: event.target.value })}
        />
      </div>
      <ListEditor
        label="Outside this mission"
        hint="Optional. Boundaries stop useful work from quietly widening the mission."
        items={fields.exclusions ?? []}
        max={8}
        onChange={(exclusions) => setFields({ exclusions })}
      />
    </div>
  );
}
