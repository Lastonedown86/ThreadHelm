import { useState } from 'react';
import { CUSTOM_MODEL, MODEL_OPTIONS, ModelPicker } from '../launch/ModelPicker.js';

export function WorkerModelPicker({
  providerId,
  index,
  model,
  onChange,
}: {
  providerId: keyof typeof MODEL_OPTIONS;
  index: number;
  model: string | null;
  onChange(model: string | null): void;
}) {
  const [custom, setCustom] = useState(false);
  const known = MODEL_OPTIONS[providerId].some((option) => option.value === model);
  const choice = custom || (model !== null && !known) ? CUSTOM_MODEL : (model ?? '');
  return (
    <>
      <ModelPicker
        providerId={providerId}
        label={`Worker ${index} model`}
        customLabel={`Worker ${index} custom model identifier`}
        choice={choice}
        customModel={model ?? ''}
        onChoice={(value) => {
          setCustom(value === CUSTOM_MODEL);
          onChange(value === CUSTOM_MODEL || value === '' ? null : value);
        }}
        onCustom={(value) => onChange(value || null)}
      />
      {choice === CUSTOM_MODEL ? (
        <p className="hint">Leave blank to use CLI default. Mission runtime limits still apply.</p>
      ) : null}
    </>
  );
}
