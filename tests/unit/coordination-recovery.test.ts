import { describe, expect, it } from 'vitest';
import { reconcileCoordinationAtStartup } from '../../apps/desktop/src/main/coordination/recovery.js';
import { createWorld, identity } from '../contract/helpers/fake-context.js';

describe('coordination startup recovery', () => {
  it('converts prepared attempts to unknown without writing to either terminal', async () => {
    const world = createWorld();
    world.addDir('C:\\recovery-a', identity(1));
    world.addDir('C:\\recovery-b', identity(2));
    const source = await world.launch((await world.approve('C:\\recovery-a')).id, 'codex-cli');
    const recipient = await world.launch((await world.approve('C:\\recovery-b')).id, 'claude-code');
    const repository = world.ctx.storage!.repositories.coordination;
    const handoff = repository.createHandoff({
      senderSessionId: source.id,
      recipientSessionId: recipient.id,
      senderWorkspaceIdAtCreate: world.ctx.live.get(source.id)!.workspaceId,
      recipientWorkspaceIdAtCreate: world.ctx.live.get(recipient.id)!.workspaceId,
      origin: 'user',
      kind: 'request',
      requiresReply: true,
      purpose: 'Recovery fixture',
      body: 'Do not replay this body.',
      createdAt: world.ctx.clock().toISOString(),
    });
    const attempt = repository.prepareAttempt({
      handoffId: handoff.id,
      recipientSessionId: recipient.id,
      recipientWorkspaceIdAtReview: world.ctx.live.get(recipient.id)!.workspaceId,
      lifecycleStateAtReview: 'running',
      activityStateAtReview: 'unknown',
      activityEvidenceKindAtReview: 'none',
      createdAt: world.ctx.clock().toISOString(),
    });
    const inputCounts = world.hosts.map(
      (host) => host.received.filter((message) => message.type === 'host.input').length,
    );

    expect(reconcileCoordinationAtStartup(world.ctx)).toEqual({ recoveredUnknown: 1 });
    expect(repository.findAttemptById(attempt.id)?.state).toBe('unknown');
    expect(repository.findHandoffById(handoff.id)?.deliveryState).toBe('manual_actionable');
    expect(
      world.hosts.map(
        (host) => host.received.filter((message) => message.type === 'host.input').length,
      ),
    ).toEqual(inputCounts);
    expect(reconcileCoordinationAtStartup(world.ctx)).toEqual({ recoveredUnknown: 0 });
  });
});
