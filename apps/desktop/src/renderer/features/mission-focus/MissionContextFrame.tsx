import type { ReactNode } from 'react';

export function MissionContextFrame({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div className="mission-context-content">
      <h2>{heading}</h2>
      {children}
    </div>
  );
}
