import { describe, expect, it } from 'vitest';
import {
  CoordinationDisclosures,
  CoordinationDisclosureStore,
} from '../../../apps/desktop/src/main/coordination/disclosures.js';
import { createWorld, identity } from '../../contract/helpers/fake-context.js';

describe('CoordinationDisclosureStore', () => {
  it('rejects a token used for another purpose', () => {
    const store = new CoordinationDisclosureStore<{ revision: number }>(() => 1_000);
    const disclosure = store.issue('handoff.confirm', { revision: 1 });

    expect(store.take(disclosure.token, 'memory.publish', { revision: 1 })).toBeNull();
    expect(store.take(disclosure.token, 'handoff.confirm', { revision: 1 })).toBeNull();
  });

  it('rejects a token when the exact snapshot changed', () => {
    const store = new CoordinationDisclosureStore(() => 1_000);
    const disclosure = store.issue('handoff.confirm', { revision: 1, target: 'a' });

    expect(
      store.take(disclosure.token, 'handoff.confirm', { revision: 2, target: 'a' }),
    ).toBeNull();
  });

  it('expires tokens after two minutes', () => {
    let now = 1_000;
    const store = new CoordinationDisclosureStore(() => now);
    const disclosure = store.issue('handoff.confirm', { revision: 1 });

    now += 120_000;
    expect(store.take(disclosure.token, 'handoff.confirm', { revision: 1 })).toBeNull();
  });

  it('rejects replay after a successful use', () => {
    const store = new CoordinationDisclosureStore(() => 1_000);
    const disclosure = store.issue('handoff.confirm', { revision: 1 });

    expect(store.take(disclosure.token, 'handoff.confirm', { revision: 1 })).toEqual({
      revision: 1,
    });
    expect(store.take(disclosure.token, 'handoff.confirm', { revision: 1 })).toBeNull();
  });

  it('returns an immutable snapshot', () => {
    const store = new CoordinationDisclosureStore<{ nested: { revision: number } }>(() => 1_000);
    const disclosure = store.issue('handoff.confirm', { nested: { revision: 1 } });

    expect(Object.isFrozen(disclosure.snapshot)).toBe(true);
    expect(Object.isFrozen(disclosure.snapshot.nested)).toBe(true);
  });

  it('consumes only when current main-owned state still matches the stored snapshot', () => {
    const store = new CoordinationDisclosureStore<{ target: string; revision: number }>(
      () => 1_000,
    );
    const disclosure = store.issue('handoff.present', { target: 'session-a', revision: 2 });

    expect(
      store.takeBound(disclosure.token, 'handoff.present', (snapshot) => snapshot.revision === 2),
    ).toEqual({ target: 'session-a', revision: 2 });
    expect(store.takeBound(disclosure.token, 'handoff.present', () => true)).toBeNull();
  });
});

describe('US1 handoff disclosures', () => {
  it('binds preview and presentation to exact main-owned sessions and selection', async () => {
    const world = createWorld();
    world.addDir('C:\\fixture-a', identity(1));
    world.addDir('C:\\fixture-b', identity(2));
    const source = await world.launch((await world.approve('C:\\fixture-a')).id, 'codex-cli');
    const recipient = await world.launch((await world.approve('C:\\fixture-b')).id, 'claude-code');
    const disclosures = new CoordinationDisclosures(world.ctx);

    const preview = disclosures.previewHandoff({
      sourceSessionId: source.id,
      recipientSessionId: recipient.id,
      kind: 'request',
      purpose: 'Review exact recipient',
      body: 'Check delivery ordering.',
      responseExpected: true,
    });
    const snapshot = disclosures.takeHandoffPreview(preview.previewToken);
    const handoff = world.ctx.storage!.repositories.coordination.createHandoff({
      id: snapshot.handoffId,
      conversationId: snapshot.conversationId,
      inReplyToId: snapshot.inReplyToId,
      senderSessionId: snapshot.sourceSessionId,
      recipientSessionId: snapshot.recipientSessionId,
      senderWorkspaceIdAtCreate: snapshot.sourceWorkspaceId,
      recipientWorkspaceIdAtCreate: snapshot.recipientWorkspaceId,
      origin: 'user',
      kind: snapshot.kind,
      requiresReply: snapshot.responseExpected,
      purpose: snapshot.normalizedPurpose,
      body: snapshot.normalizedBody,
      createdAt: snapshot.createdAt,
    });
    await world.ok('sessions.select', { sessionId: recipient.id });
    const presentation = disclosures.requestPresentation(handoff);
    expect(disclosures.takePresentation(presentation.presentationToken)).toMatchObject({
      handoffId: handoff.id,
      recipientSessionId: recipient.id,
      selectedSessionId: recipient.id,
    });
    expect(presentation.terminalEnvelope).toContain('Authority: Context only');
    world.ctx.storage!.repositories.coordination.cancelHandoff(
      handoff.id,
      '2026-08-28T12:00:01.000Z',
    );
    const cancelled = world.ctx.storage!.repositories.coordination.findHandoffById(handoff.id)!;
    expect(() => disclosures.requestPresentation(cancelled)).toThrowError(
      expect.objectContaining({ code: 'INVALID_STATE' }),
    );
  });

  it('consumes and rejects a handoff preview when workspace approval changes', async () => {
    const world = createWorld();
    world.addDir('C:\\fixture-a', identity(1));
    world.addDir('C:\\fixture-b', identity(2));
    const sourceWorkspace = await world.approve('C:\\fixture-a');
    const source = await world.launch(sourceWorkspace.id, 'codex-cli');
    const recipientWorkspace = await world.approve('C:\\fixture-b');
    const recipient = await world.launch(recipientWorkspace.id, 'claude-code');
    const disclosures = new CoordinationDisclosures(world.ctx);
    const preview = disclosures.previewHandoff({
      sourceSessionId: source.id,
      recipientSessionId: recipient.id,
      kind: 'request',
      purpose: 'Approval drift',
      body: 'Fail closed before persistence.',
      responseExpected: true,
    });

    world.ctx.storage!.repositories.workspaces.revoke(
      recipientWorkspace.id,
      '2026-08-28T12:00:01.000Z',
    );
    expect(() => disclosures.takeHandoffPreview(preview.previewToken)).toThrowError(
      expect.objectContaining({ code: 'CONFIRMATION_EXPIRED' }),
    );
  });

  it('consumes and rejects a presentation when reviewed activity evidence drifts', async () => {
    const world = createWorld();
    world.addDir('C:\\fixture-a', identity(1));
    world.addDir('C:\\fixture-b', identity(2));
    const source = await world.launch((await world.approve('C:\\fixture-a')).id, 'codex-cli');
    const recipient = await world.launch((await world.approve('C:\\fixture-b')).id, 'claude-code');
    const disclosures = new CoordinationDisclosures(world.ctx);
    const preview = disclosures.previewHandoff({
      sourceSessionId: source.id,
      recipientSessionId: recipient.id,
      kind: 'inform',
      purpose: 'Fixture',
      body: 'Fixture body',
      responseExpected: false,
    });
    const snapshot = disclosures.takeHandoffPreview(preview.previewToken);
    const handoff = world.ctx.storage!.repositories.coordination.createHandoff({
      id: snapshot.handoffId,
      conversationId: snapshot.conversationId,
      senderSessionId: snapshot.sourceSessionId,
      recipientSessionId: snapshot.recipientSessionId,
      senderWorkspaceIdAtCreate: snapshot.sourceWorkspaceId,
      recipientWorkspaceIdAtCreate: snapshot.recipientWorkspaceId,
      origin: 'user',
      kind: snapshot.kind,
      requiresReply: false,
      purpose: snapshot.normalizedPurpose,
      body: snapshot.normalizedBody,
      createdAt: snapshot.createdAt,
    });
    await world.ok('sessions.select', { sessionId: recipient.id });
    const presentation = disclosures.requestPresentation(handoff);
    world.ctx.storage!.repositories.sessions.update(
      recipient.id,
      {
        activityState: 'working',
        activityEvidenceKind: 'structured_fixture',
        activityObservedAt: '2026-08-28T12:00:01.000Z',
      },
      '2026-08-28T12:00:01.000Z',
    );
    expect(() => disclosures.takePresentation(presentation.presentationToken)).toThrowError(
      expect.objectContaining({ code: 'CONFIRMATION_EXPIRED' }),
    );
  });
});
