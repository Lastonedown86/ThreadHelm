import { useState, type FormEvent } from 'react';

const starters = [
  ['Decisions', 'decisions and their evidence'],
  ['Constraints', 'current constraints and boundaries'],
  ['Lessons', 'lessons from previous work'],
] as const;

export function MemoryLibrarian({ onSearch }: { onSearch(query: string): void }) {
  const [request, setRequest] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const query = request.trim();
    if (query) onSearch(query);
  };
  return (
    <aside className="memory-librarian" aria-labelledby="librarian-heading">
      <p className="eyebrow">Librarian coach</p>
      <h2 id="librarian-heading">What evidence do you need?</h2>
      <p>
        I can construct a scoped search and explain the catalog. I cannot publish, resolve, delete,
        or call a provider.
      </p>
      <form onSubmit={submit}>
        <label className="field">
          Describe what you are looking for
          <input
            value={request}
            onChange={(event) => setRequest(event.target.value)}
            placeholder="Example: launch safety decisions"
          />
        </label>
        <button type="submit" className="primary" disabled={!request.trim()}>
          Search the library
        </button>
      </form>
      <div className="librarian-starters" aria-label="Guided searches">
        {starters.map(([label, query]) => (
          <button type="button" className="small" key={label} onClick={() => onSearch(query)}>
            {label}
          </button>
        ))}
      </div>
      <details>
        <summary>How results are chosen</summary>
        <p>
          Search stays inside the selected approved workspace. Each result identifies its kind,
          author, lifecycle, citations, and exact revision lineage.
        </p>
      </details>
    </aside>
  );
}
