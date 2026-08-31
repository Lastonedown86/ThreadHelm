/** Main-owned shared-memory orchestration, disclosure tokens, scope derivation, and events. */

import {
  isSafeAuthoredText,
  MemoryDeletionDisclosureView,
  MemoryPublishDisclosureView,
  MemorySupersedeDisclosureView,
  ThreadHelmError,
  type MemoryDetailView,
  type MemoryScope,
  type MemorySearchPageView,
  type OperationRequest,
  type ProviderMemoryGetInput,
  type ProviderMemoryProposeRevisionInput,
  type ProviderMemorySearchInput,
} from '@threadhelm/contracts';
import type { SharedMemoryRepository, Storage } from '@threadhelm/persistence';
import type { Context } from '../context.js';
import { TokenStore } from '../tokens.js';
import { revalidateWorkspace } from '../workspaces/identity.js';

interface PublishSnapshot {
  request: OperationRequest<'memory.previewPublish'>;
}

interface SupersedeSnapshot {
  request: OperationRequest<'memory.previewSupersede'>;
  scope: MemoryScope;
}

interface DeletionSnapshot {
  entryId: string;
  revisionId: string;
  scope: MemoryScope;
}

export interface MemoryBridgeAuthority {
  searchForSession(sessionId: string, request: ProviderMemorySearchInput): MemorySearchPageView;
  getForSession(sessionId: string, request: ProviderMemoryGetInput): MemoryDetailView;
  proposeForSession(
    sessionId: string,
    request: ProviderMemoryProposeRevisionInput,
  ): MemoryDetailView;
}

export interface MemoryService extends MemoryBridgeAuthority {
  search(request: OperationRequest<'memory.search'>): MemorySearchPageView;
  get(request: OperationRequest<'memory.get'>): MemoryDetailView;
  previewPublish(request: OperationRequest<'memory.previewPublish'>): MemoryPublishDisclosureView;
  confirmPublish(request: OperationRequest<'memory.confirmPublish'>): MemoryDetailView;
  previewSupersede(
    request: OperationRequest<'memory.previewSupersede'>,
  ): MemorySupersedeDisclosureView;
  confirmSupersede(request: OperationRequest<'memory.confirmSupersede'>): MemoryDetailView;
  retract(request: OperationRequest<'memory.retract'>): MemoryDetailView;
  resolveConflict(request: OperationRequest<'memory.resolveConflict'>): MemoryDetailView;
  requestDeletion(
    request: OperationRequest<'memory.requestDeletion'>,
  ): MemoryDeletionDisclosureView;
  confirmDeletion(request: OperationRequest<'memory.confirmDeletion'>): MemoryDetailView;
}

function credentialLike(content: string): boolean {
  return (
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/u.test(content) ||
    /\b(api[_-]?key|access[_-]?token|password|secret)\s*[:=]\s*[^\s]{8,}/iu.test(content)
  );
}

class MainMemoryService implements MemoryService {
  readonly #ctx: Context;
  readonly #publishTokens: TokenStore<PublishSnapshot>;
  readonly #supersedeTokens: TokenStore<SupersedeSnapshot>;
  readonly #deletionTokens: TokenStore<DeletionSnapshot>;
  #sequence = 0;

  constructor(ctx: Context) {
    this.#ctx = ctx;
    const now = () => ctx.clock().getTime();
    this.#publishTokens = new TokenStore(undefined, now);
    this.#supersedeTokens = new TokenStore(undefined, now);
    this.#deletionTokens = new TokenStore(undefined, now);
  }

  search(request: OperationRequest<'memory.search'>): MemorySearchPageView {
    this.#expireDue();
    const options = {
      scope: request.scope,
      query: request.query,
      ...(request.kind ? { kind: request.kind } : {}),
      ...(request.includeContested || request.status === 'contested'
        ? { includeContested: true }
        : {}),
      ...(request.cursor ? { cursor: request.cursor } : {}),
      ...(request.limit ? { limit: request.limit } : {}),
    };
    return this.#repo().search(options);
  }

  get(request: OperationRequest<'memory.get'>): MemoryDetailView {
    this.#expireDue();
    return this.#repo().get(request.entryId, request.scope, request.revisionId);
  }

  previewPublish(request: OperationRequest<'memory.previewPublish'>): MemoryPublishDisclosureView {
    this.#assertWritable();
    this.#assertContent(request.title ?? null, request.body);
    this.#assertScope(request.scope);
    const issued = this.#publishTokens.issue({ request });
    return MemoryPublishDisclosureView.parse({
      publishToken: issued.token,
      scope: request.scope,
      kind: request.kind,
      title: request.title ?? null,
      body: request.body,
      sourceRefs: request.sourceRefs ?? [],
      confidence: request.confidence ?? 'unknown',
      memoryExpiresAt: request.memoryExpiresAt ?? null,
      expiresAt: issued.expiresAt,
      safeSummary: 'Publish one deliberate revision; shared memory never grants authority.',
    });
  }

  confirmPublish(request: OperationRequest<'memory.confirmPublish'>): MemoryDetailView {
    this.#assertWritable();
    const snapshot = this.#publishTokens.take(request.publishToken);
    if (!snapshot) throw new ThreadHelmError('CONFIRMATION_EXPIRED', 'Memory preview expired.');
    this.#assertScope(snapshot.request.scope);
    const at = this.#ctx.clock().toISOString();
    const published = this.#repo().publish({
      scope: snapshot.request.scope,
      kind: snapshot.request.kind,
      title: snapshot.request.title ?? null,
      body: snapshot.request.body,
      sourceRefs: snapshot.request.sourceRefs ?? [],
      authorSessionId: null,
      authorUser: true,
      confidence: snapshot.request.confidence ?? 'unknown',
      submission: 'deliberate',
      createdAt: at,
      expiresAt: snapshot.request.memoryExpiresAt ?? null,
    });
    const detail = this.#repo().get(published.entry.id, snapshot.request.scope);
    this.#emit(detail);
    return detail;
  }

  previewSupersede(
    request: OperationRequest<'memory.previewSupersede'>,
  ): MemorySupersedeDisclosureView {
    this.#assertWritable();
    this.#assertContent(request.title ?? null, request.body);
    const scope = this.#repo().scopeForEntry(request.entryId);
    this.#assertScope(scope);
    const detail = this.#repo().get(request.entryId, scope);
    if (detail.summary.revisionId !== request.targetRevisionId) {
      throw new ThreadHelmError('MEMORY_REVISION_STALE', 'The target revision changed.');
    }
    const issued = this.#supersedeTokens.issue({ request, scope });
    return MemorySupersedeDisclosureView.parse({
      supersedeToken: issued.token,
      entryId: request.entryId,
      targetRevisionId: request.targetRevisionId,
      title: request.title ?? null,
      body: request.body,
      sourceRefs: request.sourceRefs ?? [],
      confidence: request.confidence ?? 'unknown',
      expiresAt: issued.expiresAt,
      safeSummary: 'Append one attributable revision; the prior revision remains in lineage.',
    });
  }

  confirmSupersede(request: OperationRequest<'memory.confirmSupersede'>): MemoryDetailView {
    this.#assertWritable();
    const snapshot = this.#supersedeTokens.take(request.supersedeToken);
    if (!snapshot) throw new ThreadHelmError('CONFIRMATION_EXPIRED', 'Memory preview expired.');
    this.#assertScope(snapshot.scope);
    const current = this.#repo().get(snapshot.request.entryId, snapshot.scope);
    if (current.summary.revisionId !== snapshot.request.targetRevisionId) {
      throw new ThreadHelmError('MEMORY_REVISION_STALE', 'The target revision changed.');
    }
    this.#repo().supersede({
      entryId: snapshot.request.entryId,
      targetRevisionId: snapshot.request.targetRevisionId,
      title: snapshot.request.title ?? null,
      body: snapshot.request.body,
      sourceRefs: snapshot.request.sourceRefs ?? [],
      authorSessionId: null,
      authorUser: true,
      confidence: snapshot.request.confidence ?? 'unknown',
      submission: 'deliberate',
      createdAt: this.#ctx.clock().toISOString(),
    });
    const detail = this.#repo().get(snapshot.request.entryId, snapshot.scope);
    this.#emit(detail);
    return detail;
  }

  retract(request: OperationRequest<'memory.retract'>): MemoryDetailView {
    this.#assertWritable();
    const scope = this.#repo().scopeForEntry(request.entryId);
    const detail = this.#repo().retract({
      entryId: request.entryId,
      revisionId: request.revisionId,
      reasonCode: request.reasonCode,
      retractedAt: this.#ctx.clock().toISOString(),
    });
    this.#emit(detail);
    return this.#repo().get(request.entryId, scope);
  }

  resolveConflict(request: OperationRequest<'memory.resolveConflict'>): MemoryDetailView {
    this.#assertWritable();
    if (!request.resolutionRevisionId) {
      throw new ThreadHelmError(
        'MEMORY_CONFLICT_OPEN',
        'Leaving a conflict unresolved does not mutate shared memory.',
      );
    }
    const resolutionEntryId = this.#repo().entryIdForRevision(request.resolutionRevisionId);
    const resolutionScope = this.#repo().scopeForEntry(resolutionEntryId);
    const before = this.#repo().get(resolutionEntryId, resolutionScope);
    const conflict = before.conflicts.find((candidate) => candidate.id === request.conflictId);
    if (!conflict) throw new ThreadHelmError('MEMORY_NOT_FOUND', 'Memory conflict was not found.');
    this.#repo().resolveConflict({
      conflictId: request.conflictId,
      resolutionRevisionId: request.resolutionRevisionId,
      resolvedAt: this.#ctx.clock().toISOString(),
    });
    let detail: MemoryDetailView | null = null;
    for (const entryId of new Set([
      conflict.leftEntryId,
      conflict.rightEntryId,
      resolutionEntryId,
    ])) {
      const changed = this.#repo().get(entryId, this.#repo().scopeForEntry(entryId));
      this.#emit(changed);
      if (entryId === resolutionEntryId) detail = changed;
    }
    this.#ctx.events.emit('memory.conflictChanged', {
      conflictId: request.conflictId,
      state: 'resolved',
      sequence: ++this.#sequence,
      occurredAt: this.#ctx.clock().toISOString(),
    });
    return detail!;
  }

  requestDeletion(
    request: OperationRequest<'memory.requestDeletion'>,
  ): MemoryDeletionDisclosureView {
    this.#assertWritable();
    const scope = this.#repo().scopeForEntry(request.entryId);
    const detail = this.#repo().get(request.entryId, scope);
    const issued = this.#deletionTokens.issue({
      entryId: request.entryId,
      revisionId: detail.summary.revisionId,
      scope,
    });
    return MemoryDeletionDisclosureView.parse({
      deletionToken: issued.token,
      entryId: request.entryId,
      expiresAt: issued.expiresAt,
      safeSummary: 'Delete title, body, sources, size, and FTS rows; content-free lineage remains.',
    });
  }

  confirmDeletion(request: OperationRequest<'memory.confirmDeletion'>): MemoryDetailView {
    this.#assertWritable();
    const snapshot = this.#deletionTokens.take(request.deletionToken);
    if (!snapshot) throw new ThreadHelmError('CONFIRMATION_EXPIRED', 'Deletion preview expired.');
    const current = this.#repo().get(snapshot.entryId, snapshot.scope);
    if (current.summary.revisionId !== snapshot.revisionId) {
      throw new ThreadHelmError('MEMORY_REVISION_STALE', 'The deletion target changed.');
    }
    const detail = this.#repo().deleteContent({
      entryId: snapshot.entryId,
      deletedAt: this.#ctx.clock().toISOString(),
    });
    this.#emit(detail);
    return detail;
  }

  searchForSession(sessionId: string, request: ProviderMemorySearchInput): MemorySearchPageView {
    this.#expireDue();
    const scope = this.#scopeForSession(sessionId);
    return this.#repo().search({
      scope,
      query: request.query,
      ...(request.kind ? { kind: request.kind } : {}),
      ...(request.includeContested ? { includeContested: true } : {}),
      ...(request.cursor ? { cursor: request.cursor } : {}),
      ...(request.limit ? { limit: request.limit } : {}),
    });
  }

  getForSession(sessionId: string, request: ProviderMemoryGetInput): MemoryDetailView {
    this.#expireDue();
    return this.#repo().get(request.entryId, this.#scopeForSession(sessionId), request.revisionId);
  }

  proposeForSession(
    sessionId: string,
    request: ProviderMemoryProposeRevisionInput,
  ): MemoryDetailView {
    this.#assertWritable();
    this.#assertContent(request.title ?? null, request.body);
    const scope = this.#scopeForSession(sessionId);
    const published = this.#repo().publish({
      scope,
      kind: request.kind,
      title: request.title ?? null,
      body: request.body,
      sourceRefs: request.sourceRefs,
      authorSessionId: sessionId,
      authorUser: false,
      confidence: request.confidence,
      submission: 'deliberate',
      createdAt: this.#ctx.clock().toISOString(),
      expiresAt: request.memoryExpiresAt ?? null,
    });

    // Exact same titled subject in the same scope is a deterministic conflict candidate.
    if (request.title) {
      const matches = this.#repo().search({
        scope,
        query: request.title,
        includeContested: true,
        limit: 20,
      });
      const competing = matches.items.find((item) => {
        if (item.entryId === published.entry.id || item.title !== request.title) return false;
        const detail = this.#repo().get(item.entryId, scope);
        return detail.body !== request.body;
      });
      if (competing) {
        const conflict = this.#repo().reportConflict({
          leftRevisionId: competing.revisionId,
          rightRevisionId: published.revision.id,
          reasonCode: 'EXACT_SUBJECT_CONFLICT',
          createdAt: this.#ctx.clock().toISOString(),
        });
        this.#ctx.events.emit('memory.conflictChanged', {
          conflictId: conflict.id,
          state: conflict.state,
          sequence: ++this.#sequence,
          occurredAt: this.#ctx.clock().toISOString(),
        });
      }
    }
    const detail = this.#repo().get(published.entry.id, scope);
    this.#emit(detail);
    return detail;
  }

  #scopeForSession(sessionId: string): MemoryScope {
    const session = this.#storage().repositories.sessions.findById(sessionId);
    if (!session) throw new ThreadHelmError('UNAUTHORIZED_SENDER', 'Memory session is not active.');
    const workspace = this.#storage().repositories.workspaces.findById(session.workspaceId);
    if (!workspace || workspace.revokedAt) {
      throw new ThreadHelmError(
        'MEMORY_SCOPE_UNAUTHORIZED',
        'The authenticated session workspace is not approved.',
      );
    }
    revalidateWorkspace(this.#ctx, workspace);
    const role = this.#storage().repositories.supervisor.roleForSession(sessionId);
    if (role) {
      const scope = { missionId: role.missionId };
      this.#assertScope(scope);
      const envelope = this.#storage().repositories.supervisor.envelope(role.missionId);
      if (
        !envelope?.bindings.some(
          (binding) =>
            binding.bindingId === role.bindingId && binding.workspaceId === session.workspaceId,
        ) ||
        this.#ctx.live.get(sessionId)?.state !== 'running'
      )
        throw new ThreadHelmError('MEMORY_SCOPE_UNAUTHORIZED');
      return scope;
    }
    return { workspaceId: session.workspaceId };
  }

  #assertContent(title: string | null, body: string): void {
    if (
      !body.trim() ||
      Buffer.byteLength(body.trim(), 'utf8') > 16_384 ||
      !isSafeAuthoredText(title ?? '') ||
      !isSafeAuthoredText(body) ||
      credentialLike(`${title ?? ''}\n${body}`)
    ) {
      throw new ThreadHelmError(
        'MEMORY_CONTENT_INVALID',
        'Shared-memory content did not pass validation.',
      );
    }
  }

  #assertScope(scope: MemoryScope): void {
    if ('missionId' in scope && scope.missionId) {
      const mission = this.#storage()
        .db.prepare('SELECT state FROM supervisor_missions WHERE id=?')
        .get(scope.missionId) as { state: string } | undefined;
      if (!mission || mission.state === 'deleted')
        throw new ThreadHelmError('MEMORY_SCOPE_UNAUTHORIZED');
      const envelope = this.#storage().repositories.supervisor.envelope(scope.missionId);
      if (!envelope) throw new ThreadHelmError('MEMORY_SCOPE_UNAUTHORIZED');
      for (const binding of envelope.bindings) {
        const workspace = this.#storage().repositories.workspaces.findById(binding.workspaceId);
        if (!workspace || workspace.revokedAt)
          throw new ThreadHelmError('MEMORY_SCOPE_UNAUTHORIZED');
        const current = revalidateWorkspace(this.#ctx, workspace);
        if (
          current.identity.volumeSerial !== binding.identity.volumeSerial ||
          current.identity.fileId !== binding.identity.fileId
        )
          throw new ThreadHelmError('MEMORY_SCOPE_UNAUTHORIZED');
      }
    }
    if ('workspaceId' in scope && scope.workspaceId) {
      const workspace = this.#storage().repositories.workspaces.findById(scope.workspaceId);
      if (!workspace || workspace.revokedAt) {
        throw new ThreadHelmError(
          'MEMORY_SCOPE_UNAUTHORIZED',
          'The shared-memory workspace is not approved.',
        );
      }
    }
  }

  #assertWritable(): void {
    if (this.#ctx.health.degraded || !this.#ctx.storage) {
      throw new ThreadHelmError(
        'STORAGE_DEGRADED',
        'Shared-memory writes are unavailable while storage is degraded.',
      );
    }
  }

  #storage(): Storage {
    if (!this.#ctx.storage) {
      throw new ThreadHelmError('STORAGE_UNAVAILABLE', 'Shared-memory storage is unavailable.');
    }
    return this.#ctx.storage;
  }

  #repo(): SharedMemoryRepository {
    return this.#storage().repositories.memory;
  }

  #expireDue(): void {
    if (!this.#ctx.storage || this.#ctx.health.degraded) return;
    const repository = this.#repo();
    for (const entryId of repository.expireDue(this.#ctx.clock().toISOString())) {
      this.#emit(repository.get(entryId, repository.scopeForEntry(entryId)));
    }
  }

  #emit(detail: MemoryDetailView): void {
    this.#ctx.events.emit('memory.changed', {
      entryId: detail.summary.entryId,
      revisionId: detail.summary.revisionId,
      scope: detail.summary.scope,
      kind: detail.summary.kind,
      status: detail.summary.status,
      author: detail.summary.author,
      conflictCount: detail.summary.conflictCount,
      sequence: ++this.#sequence,
      occurredAt: this.#ctx.clock().toISOString(),
    });
  }
}

export function createMemoryService(ctx: Context): MemoryService {
  return new MainMemoryService(ctx);
}
