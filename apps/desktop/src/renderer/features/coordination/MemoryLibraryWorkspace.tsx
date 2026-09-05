import { useState } from 'react';
import type { MemoryDetailView } from '@threadhelm/contracts';
import { MemoryLibrarian } from './MemoryLibrarian.js';
import { MemoryList } from './MemoryList.js';
import { MissionReadingList } from './MissionReadingList.js';

export function MemoryLibraryWorkspace() {
  const [query, setQuery] = useState('');
  const [searchVersion, setSearchVersion] = useState(0);
  const [readingList, setReadingList] = useState<MemoryDetailView[]>([]);
  const search = (next: string) => {
    setQuery(next);
    setSearchVersion((value) => value + 1);
  };
  const add = (detail: MemoryDetailView) =>
    setReadingList((items) =>
      items.some((item) => item.summary.revisionId === detail.summary.revisionId)
        ? items
        : [...items, detail],
    );
  return (
    <main className="memory-library-workspace" aria-labelledby="memory-library-heading">
      <header className="workspace-page-header">
        <p className="eyebrow">Evidence library</p>
        <h1 id="memory-library-heading">Find, read, and cite local knowledge</h1>
        <p>
          Search opens exact volumes and editions. Publication remains a separate reviewed action.
        </p>
      </header>
      <div className="memory-library-grid">
        <MemoryLibrarian onSearch={search} />
        <section className="memory-reading-desk" aria-label="Reading desk">
          <MemoryList
            searchVersion={searchVersion}
            initialQuery={query}
            expanded
            onAddToReadingList={add}
          />
        </section>
        <MissionReadingList
          items={readingList}
          onRemove={(revisionId) =>
            setReadingList((items) =>
              items.filter((item) => item.summary.revisionId !== revisionId),
            )
          }
        />
      </div>
    </main>
  );
}
