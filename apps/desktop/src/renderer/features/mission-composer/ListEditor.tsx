import { useId, useState } from 'react';

export function ListEditor({
  label,
  items,
  max,
  itemMax = 500,
  hint,
  dataField,
  invalid,
  onChange,
}: {
  label: string;
  items: string[];
  max: number;
  itemMax?: number;
  hint?: string;
  dataField?: string;
  invalid?: boolean;
  onChange(items: string[]): void;
}) {
  const [text, setText] = useState('');
  const id = useId();
  const add = () => {
    const value = text.trim();
    if (!value || items.length >= max) return;
    onChange([...items, value.slice(0, itemMax)]);
    setText('');
  };
  const lower = label.charAt(0).toLowerCase() + label.slice(1);
  return (
    <div className="composer-list-editor">
      <label className="field" htmlFor={id}>
        {label}
      </label>
      {hint ? <p className="hint">{hint}</p> : null}
      <div className="composer-list-row">
        <input
          id={id}
          data-field={dataField}
          aria-invalid={invalid || undefined}
          value={text}
          maxLength={itemMax}
          disabled={items.length >= max}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          className="small"
          onClick={add}
          disabled={!text.trim() || items.length >= max}
        >
          Add to {lower}
        </button>
      </div>
      {items.length ? (
        <ul className="composer-list" aria-label={label}>
          {items.map((item, index) => (
            <li key={`${index}-${item}`}>
              <span>{item}</span>
              <button
                type="button"
                className="small"
                aria-label={`Remove ${item}`}
                onClick={() => onChange(items.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="hint">
        {items.length} of {max}
      </p>
    </div>
  );
}
