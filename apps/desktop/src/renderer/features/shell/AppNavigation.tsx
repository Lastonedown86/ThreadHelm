import type { WorkspaceDestination } from './navigation.js';

const destinations: ReadonlyArray<{ id: WorkspaceDestination; label: string }> = [
  { id: 'missions', label: 'Missions' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'agents', label: 'Agents' },
  { id: 'templates', label: 'Templates' },
  { id: 'memory', label: 'Memory' },
  { id: 'settings', label: 'Settings' },
];

export interface AppNavigationProps {
  selected: WorkspaceDestination;
  onSelect(destination: WorkspaceDestination): void;
}

export function AppNavigation({ selected, onSelect }: AppNavigationProps) {
  return (
    <div className="app-navigation" aria-label="Destinations">
      {destinations.map((destination) => (
        <button
          key={destination.id}
          type="button"
          className={destination.id === selected ? 'selected' : undefined}
          aria-current={destination.id === selected ? 'page' : undefined}
          onClick={() => onSelect(destination.id)}
        >
          {destination.label}
        </button>
      ))}
    </div>
  );
}
