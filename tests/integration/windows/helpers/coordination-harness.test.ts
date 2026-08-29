import { describe, expect, it, vi } from 'vitest';
import { CoordinationHarness, type CoordinationTestApp } from './coordination-harness.js';

describe('CoordinationHarness', () => {
  it('registers and looks up fixture sessions deterministically', () => {
    const app = {} as CoordinationTestApp;
    const harness = new CoordinationHarness(app);
    const session = {
      id: 'session-a',
      providerId: 'codex-cli' as const,
      workspaceId: 'workspace-a',
    };

    harness.registerSession(session);

    expect(harness.session('session-a')).toEqual(session);
    expect(harness.sessionIds()).toEqual(['session-a']);
  });

  it('delegates crash and power boundaries to the launched app', async () => {
    const app: CoordinationTestApp = {
      crashCoordinator: vi.fn().mockResolvedValue(undefined),
      simulatePower: vi.fn().mockResolvedValue(undefined),
    };
    const harness = new CoordinationHarness(app);

    await harness.crashBoundary();
    await harness.powerBoundary('suspend');

    expect(app.crashCoordinator).toHaveBeenCalledOnce();
    expect(app.simulatePower).toHaveBeenCalledWith('suspend');
  });
});
