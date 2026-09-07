import { useId } from 'react';
export const CUSTOM_MODEL = '__custom__';

export const MODEL_OPTIONS = {
  'codex-cli': [
    { value: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
    { value: 'gpt-5.6-terra', label: 'GPT-5.6 Terra' },
    { value: 'gpt-5.6-luna', label: 'GPT-5.6 Luna' },
    { value: 'gpt-5.5', label: 'GPT-5.5' },
    { value: 'gpt-5.4', label: 'GPT-5.4' },
    { value: 'gpt-5.4-mini', label: 'GPT-5.4 Mini' },
    { value: 'gpt-5.3-codex-spark', label: 'GPT-5.3 Codex Spark' },
  ],
  'claude-code': [
    { value: 'fable', label: 'Claude Fable 5' },
    { value: 'opus', label: 'Claude Opus' },
    { value: 'sonnet', label: 'Claude Sonnet' },
  ],
} as const;

export function ModelPicker({
  providerId,
  label = 'Model',
  customLabel = 'Custom model identifier',
  choice,
  customModel,
  onChoice,
  onCustom,
}: {
  providerId: keyof typeof MODEL_OPTIONS;
  label?: string;
  customLabel?: string;
  choice: string;
  customModel: string;
  onChoice(value: string): void;
  onCustom(value: string): void;
}) {
  const id = useId();
  return (
    <>
      <label className="field" htmlFor={id}>
        {label}
        <select
          id={id}
          aria-label={label}
          value={choice}
          onChange={(e) => onChoice(e.target.value)}
        >
          <option value="">CLI default</option>
          {MODEL_OPTIONS[providerId].map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          <option value={CUSTOM_MODEL}>Custom model…</option>
        </select>
      </label>
      {choice === CUSTOM_MODEL ? (
        <label className="field">
          {customLabel}
          <input
            value={customModel}
            maxLength={128}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => onCustom(e.target.value)}
          />
        </label>
      ) : null}
    </>
  );
}
