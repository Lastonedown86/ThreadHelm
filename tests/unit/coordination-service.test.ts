import type { CoordinationEventEnvelope } from '@threadhelm/contracts';
import { describe, expect, it, vi } from 'vitest';
import { createCoordinationService } from '../../apps/desktop/src/main/coordination/service.js';
import {
  fanOutCoordinationEvent,
  startCoordination,
  stopCoordination,
} from '../../apps/desktop/src/main/coordinator.js';
import type { Context } from '../../apps/desktop/src/main/context.js';
import { createWorld, identity } from '../contract/helpers/fake-context.js';

const event: CoordinationEventEnvelope = {
  type: 'coordination.handoffChanged',
  eventId: '11111111-1111-4111-8111-111111111111' as CoordinationEventEnvelope['eventId'],
  conversationId:
    '22222222-2222-4222-8222-222222222222' as CoordinationEventEnvelope['conversationId'],
  handoffId: '33333333-3333-4333-8333-333333333333' as CoordinationEventEnvelope['handoffId'],
  sequence: 1,
  kind: 'queued',
  reasonCode: null,
  safeSummary: 'Handoff queued',
  occurredAt: '2026-08-28T12:00:00.000Z',
};

describe('coordination service container', () => {
  it('retains main-owned dependencies without exposing routing behavior', () => {
    const dependencies = {
      clock: () => new Date(0),
      storage: null,
      events: {} as never,
      sessions: new Map(),
    };

    const service = createCoordinationService(dependencies);

    expect(service.dependencies).toBe(dependencies);
    expect(service.started).toBe(false);
  });

  it('fans out only strict content-free coordination events while started', () => {
    const emit = vi.fn();
    const service = createCoordinationService({
      clock: () => new Date(0),
      storage: null,
      events: { emit, transferStreamPort: vi.fn() },
      sessions: new Map(),
    });

    expect(() => service.publish(event)).toThrow();
    service.start();
    service.publish(event);
    expect(emit).toHaveBeenCalledWith('coordination.handoffChanged', event);
    expect(() =>
      service.publish({ ...event, body: 'must remain explicit detail' } as never),
    ).toThrow();
    service.stop();
    expect(service.started).toBe(false);
  });

  it('composes one service for coordinator startup and stops the same instance', () => {
    const ctx = {
      clock: () => new Date(0),
      storage: null,
      events: { emit: vi.fn(), transferStreamPort: vi.fn() },
      live: new Map(),
    } as unknown as Context;

    const first = startCoordination(ctx);
    const second = startCoordination(ctx);
    expect(first).toBe(second);
    expect(first.started).toBe(true);
    fanOutCoordinationEvent(ctx, event);
    expect(ctx.events.emit).toHaveBeenCalledWith('coordination.handoffChanged', event);
    stopCoordination(ctx);
    expect(first.started).toBe(false);
  });
});

describe('US1 coordination service orchestration', () => {
  it('fails closed when a reviewed workspace identity changes before persistence', async () => {
    const world = createWorld();
    world.addDir('C:\\service-a', identity(1));
    world.addDir('C:\\service-b', identity(2));
    const source = await world.launch((await world.approve('C:\\service-a')).id, 'codex-cli');
    const recipient = await world.launch((await world.approve('C:\\service-b')).id, 'claude-code');
    const service = world.ctx.coordination!;
    const preview = service.previewHandoff({
      sourceSessionId: source.id,
      recipientSessionId: recipient.id,
      kind: 'request',
      purpose: 'Identity snapshot',
      body: 'Fail closed if the target folder changes.',
      responseExpected: true,
    });

    world.addDir('C:\\service-b', identity(99));
    expect(() =>
      service.confirmHandoff({
        previewToken: preview.previewToken,
        persistenceConfirmation: true,
      }),
    ).toThrowError(expect.objectContaining({ code: 'CONFIRMATION_EXPIRED' }));
  });

  it('persists, discloses, and applies one handoff to only the exact recipient', async () => {
    const world = createWorld();
    world.addDir('C:\\service-a', identity(1));
    world.addDir('C:\\service-b', identity(2));
    const source = await world.launch((await world.approve('C:\\service-a')).id, 'codex-cli');
    const recipient = await world.launch((await world.approve('C:\\service-b')).id, 'claude-code');
    const sourceHost = world.hosts[0]!;
    const recipientHost = world.hosts[1]!;
    const service = world.ctx.coordination!;

    const preview = service.previewHandoff({
      sourceSessionId: source.id,
      recipientSessionId: recipient.id,
      kind: 'request',
      purpose: 'Verify exact delivery',
      body: 'Apply only to the reviewed recipient.',
      responseExpected: true,
    });
    const handoff = service.confirmHandoff({
      previewToken: preview.previewToken,
      persistenceConfirmation: true,
    });
    await world.ok('sessions.select', { sessionId: recipient.id });
    const disclosure = service.requestPresentation(handoff.id);
    let durableStateAtSubmit: string | null = null;
    const originalPost = recipientHost.postMessage.bind(recipientHost);
    recipientHost.postMessage = (message, ports) => {
      if (message.type === 'host.input') {
        durableStateAtSubmit =
          world.ctx.storage!.repositories.coordination.listInFlightAttempts()[0]?.state ?? null;
      }
      originalPost(message, ports);
    };
    const applied = await service.confirmPresentation({
      presentationToken: disclosure.presentationToken,
      submitConfirmation: true,
    });

    expect(applied.state).toBe('applied');
    expect(durableStateAtSubmit).toBe('dispatching');
    expect(applied.recipientSessionId).toBe(recipient.id);
    expect(recipientHost.received.filter((message) => message.type === 'host.input')).toHaveLength(
      1,
    );
    expect(sourceHost.received.some((message) => message.type === 'host.input')).toBe(false);
    expect(world.ctx.storage!.repositories.coordination.findHandoffById(handoff.id)).toMatchObject({
      deliveryState: 'delivered',
      workOutcome: 'pending',
    });
    await expect(
      service.confirmPresentation({
        presentationToken: disclosure.presentationToken,
        submitConfirmation: true,
      }),
    ).rejects.toMatchObject({ code: 'CONFIRMATION_EXPIRED' });
  });

  it('cancels or retargets only before a possible delivery', async () => {
    const world = createWorld();
    for (const [path, n] of [
      ['C:\\service-a', 1],
      ['C:\\service-b', 2],
      ['C:\\service-c', 3],
    ] as const) {
      world.addDir(path, identity(n));
    }
    const source = await world.launch((await world.approve('C:\\service-a')).id, 'codex-cli');
    const recipient = await world.launch((await world.approve('C:\\service-b')).id, 'claude-code');
    const third = await world.launch((await world.approve('C:\\service-c')).id, 'codex-cli');
    const service = world.ctx.coordination!;
    const preview = service.previewHandoff({
      sourceSessionId: source.id,
      recipientSessionId: recipient.id,
      kind: 'inform',
      purpose: 'Retarget fixture',
      body: 'No delivery yet.',
      responseExpected: false,
    });
    const handoff = service.confirmHandoff({
      previewToken: preview.previewToken,
      persistenceConfirmation: true,
    });
    const retarget = service.previewRetarget({
      handoffId: handoff.id,
      recipientSessionId: third.id,
    });
    expect(
      service.confirmRetarget({
        retargetToken: retarget.retargetToken,
        retargetConfirmation: true,
      }).recipientSessionId,
    ).toBe(third.id);
    expect(service.cancelHandoff({ handoffId: handoff.id }).deliveryState).toBe('cancelled');
  });
});
