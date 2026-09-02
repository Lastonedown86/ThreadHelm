import type { WorkspaceDestination } from './navigation.js';

const destinations: ReadonlyArray<{ id: WorkspaceDestination; label: string; countNoun: string }> =
  [
    { id: 'missions', label: 'Missions', countNoun: '' },
    { id: 'sessions', label: 'Sessions', countNoun: 'with new output' },
    { id: 'agents', label: 'Agents', countNoun: '' },
    { id: 'templates', label: 'Templates', countNoun: '' },
    { id: 'memory', label: 'Memory', countNoun: '' },
    { id: 'attention', label: 'Attention', countNoun: 'needing attention' },
    { id: 'settings', label: 'Settings', countNoun: '' },
  ];

export interface AppNavigationProps {
  selected: WorkspaceDestination;
  counts?: Partial<Record<WorkspaceDestination, number>>;
  onSelect(destination: WorkspaceDestination): void;
}

export function AppNavigation({ selected, counts = {}, onSelect }: AppNavigationProps) {
  return (
    <div className="app-navigation" aria-label="Destinations">
      {destinations.map((destination) => {
        const count = counts[destination.id] ?? 0;
        const descriptionId = `nav-count-${destination.id}`;
        return (
          <button
            key={destination.id}
            type="button"
            className={destination.id === selected ? 'selected' : undefined}
            aria-current={destination.id === selected ? 'page' : undefined}
            aria-describedby={count > 0 ? descriptionId : undefined}
            onClick={() => onSelect(destination.id)}
          >
            {destination.label}
            {count > 0 ? (
              <>
                <span className="nav-count" aria-hidden="true">
                  {count}
                </span>
                <span className="visually-hidden" id={descriptionId} aria-hidden="true">
                  {count} {destination.countNoun}
                </span>
              </>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
