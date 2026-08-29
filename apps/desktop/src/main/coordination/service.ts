/**
 * Main-owned coordination composition seam (T011, US1, US2).
 */

import { randomBytes } from 'node:crypto';
import type { RendererEvents } from '../ipc/electron-binding.js';
import type { LiveSession, Selection } from '../context.js';
import {
  CoordinationEventEnvelope,
  DeleteContentDisclosureView,
  HandoffSummaryView,
  HandoffView,
  ThreadHelmError,
  type CancelHandoffRequest,
  type ConfirmDeleteContentRequest,
  type ConfirmHandoffRequest,
  type ConfirmPresentationRequest,
  type ConfirmRetargetRequest,
  type ConversationDetailView,
  type ConversationListView,
  type ConversationState,
  type ConversationSummaryView,
  type DeliveryAttemptView,
  type HandoffPreviewView,
  type PresentationDisclosureView,
  type PreviewHandoffRequest,
  type PreviewRetargetRequest,
} from '@threadhelm/contracts';
import type {
  CoordinationHandoffRecord,
  DeliveryAttemptRecord,
  Storage,
} from '@threadhelm/persistence';
import type { ProviderAdapter } from '@threadhelm/providers';
import type { StorageHealth } from '../storage-health.js';
import {
  CoordinationDisclosures,
  type PresentationSnapshot,
  type RetargetDisclosure,
} from './disclosures.js';

export interface CoordinationDependencies {
  readonly clock: () => Date;
  readonly storage: Storage | null;
  readonly events: RendererEvents;
  readonly sessions: ReadonlyMap<string, LiveSession>;
  readonly health?: StorageHealth;
  readonly selection?: Selection;
  readonly adapters?: readonly ProviderAdapter[];
  readonly isSessionWorkspaceApproved?: (sessionId: string, workspaceId: string) => boolean;
  readonly submitDelivery?: (snapshot: PresentationSnapshot) => Promise<DeliveryAttemptRecord>;
}

export interface CoordinationService {
  readonly dependencies: CoordinationDependencies;
  readonly started: boolean;
  start(): void;
  stop(): void;
  listHandoffs(limit?: number): { handoffs: HandoffSummaryView[]; storageDegraded: boolean };
  publish(event: CoordinationEventEnvelope): void;
  previewHandoff(request: PreviewHandoffRequest): HandoffPreviewView;
  confirmHandoff(request: ConfirmHandoffRequest): HandoffView;
  requestPresentation(handoffId: string): PresentationDisclosureView;
  confirmPresentation(request: ConfirmPresentationRequest): Promise<DeliveryAttemptView>;
  cancelHandoff(request: CancelHandoffRequest): HandoffView;
  previewRetarget(request: PreviewRetargetRequest): RetargetDisclosure;
  confirmRetarget(request: ConfirmRetargetRequest): HandoffView;

  // US2 additions
  listConversations(options?: {
    state?: ConversationState;
    cursor?: string;
    limit?: number;
  }): ConversationListView;
  getConversation(request: {
    conversationId: string;
    cursor?: string;
    limit?: number;
  }): ConversationDetailView;
  pauseConversation(conversationId: string): ConversationSummaryView;
  requestContentDeletion(conversationId: string): DeleteContentDisclosureView;
  confirmContentDeletion(request: ConfirmDeleteContentRequest): ConversationSummaryView;
}

class CoordinationServiceContainer implements CoordinationService {
  readonly dependencies: CoordinationDependencies;
  #started = false;
  readonly #disclosures: CoordinationDisclosures | null;
  readonly #deletionTokens = new Map<string, { conversationId: string; expiresAt: number }>();

  constructor(dependencies: CoordinationDependencies) {
    this.dependencies = dependencies;
    this.#disclosures =
      dependencies.health && dependencies.selection && dependencies.adapters
        ? new CoordinationDisclosures({
            clock: dependencies.clock,
            storage: dependencies.storage,
            health: dependencies.health,
            live: dependencies.sessions,
            selection: dependencies.selection,
            adapters: dependencies.adapters,
            ...(dependencies.isSessionWorkspaceApproved
              ? { isSessionWorkspaceApproved: dependencies.isSessionWorkspaceApproved }
              : {}),
          })
        : null;
  }

  get started(): boolean {
    return this.#started;
  }

  start(): void {
    this.#started = true;
  }

  stop(): void {
    this.#started = false;
  }

  listHandoffs(limit = 100): { handoffs: HandoffSummaryView[]; storageDegraded: boolean } {
    this.#requireStarted();
    return {
      handoffs: this.#repository().listHandoffs(limit).map(toHandoffSummaryView),
      storageDegraded: this.dependencies.health?.degraded ?? false,
    };
  }

  publish(event: CoordinationEventEnvelope): void {
    if (!this.#started) {
      throw new ThreadHelmError('INVALID_STATE', 'Coordination service is not running.');
    }
    const contentFree = CoordinationEventEnvelope.parse(event);
    this.dependencies.events.emit('coordination.handoffChanged', contentFree);
  }

  previewHandoff(request: PreviewHandoffRequest): HandoffPreviewView {
    this.#requireStarted();
    return this.#disclosureService().previewHandoff(request);
  }

  confirmHandoff(request: ConfirmHandoffRequest): HandoffView {
    this.#requireStarted();
    const snapshot = this.#disclosureService().takeHandoffPreview(request.previewToken);
    const handoff = this.#repository().createHandoff({
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
    this.#publishLatest(handoff.id);
    return toHandoffView(handoff);
  }

  requestPresentation(handoffId: string): PresentationDisclosureView {
    this.#requireStarted();
    const handoff = this.#repository().findHandoffById(handoffId);
    if (!handoff) throw new ThreadHelmError('HANDOFF_NOT_FOUND', 'Handoff not found.');
    return this.#disclosureService().requestPresentation(handoff);
  }

  async confirmPresentation(request: ConfirmPresentationRequest): Promise<DeliveryAttemptView> {
    this.#requireStarted();
    if (!this.dependencies.submitDelivery) {
      throw new ThreadHelmError(
        'COORDINATION_NOT_ELIGIBLE',
        'Coordination delivery is not composed.',
      );
    }
    const snapshot = this.#disclosureService().takePresentation(request.presentationToken);
    const attempt = await this.dependencies.submitDelivery(snapshot);
    this.#publishLatest(snapshot.handoffId);
    return toDeliveryAttemptView(attempt);
  }

  cancelHandoff(request: CancelHandoffRequest): HandoffView {
    this.#requireStarted();
    const handoff = this.#repository().cancelHandoff(
      request.handoffId,
      this.dependencies.clock().toISOString(),
    );
    this.#publishLatest(handoff.id);
    return toHandoffView(handoff);
  }

  previewRetarget(request: PreviewRetargetRequest): RetargetDisclosure {
    this.#requireStarted();
    const handoff = this.#repository().findHandoffById(request.handoffId);
    if (!handoff) throw new ThreadHelmError('HANDOFF_NOT_FOUND', 'Handoff not found.');
    return this.#disclosureService().previewRetarget(handoff, request.recipientSessionId);
  }

  confirmRetarget(request: ConfirmRetargetRequest): HandoffView {
    this.#requireStarted();
    const snapshot = this.#disclosureService().takeRetarget(request.retargetToken);
    const handoff = this.#repository().retargetHandoff(
      snapshot.handoffId,
      snapshot.recipientSessionId,
      snapshot.recipientWorkspaceId,
      this.dependencies.clock().toISOString(),
    );
    this.#publishLatest(handoff.id);
    return toHandoffView(handoff);
  }

  // --- US2 Additions ---

  listConversations(
    options: { state?: ConversationState; cursor?: string; limit?: number } = {},
  ): ConversationListView {
    this.#requireStarted();
    const result = this.#repository().listConversations(options);
    return {
      conversations: result.conversations,
      nextCursor: result.nextCursor,
      storageDegraded: this.dependencies.health?.degraded ?? false,
    };
  }

  getConversation(request: {
    conversationId: string;
    cursor?: string;
    limit?: number;
  }): ConversationDetailView {
    this.#requireStarted();
    const opts: { cursor?: string; limit?: number } = {};
    if (request.cursor !== undefined) opts.cursor = request.cursor;
    if (request.limit !== undefined) opts.limit = request.limit;
    return this.#repository().getConversationDetail(request.conversationId, opts);
  }

  pauseConversation(conversationId: string): ConversationSummaryView {
    this.#requireStarted();
    const current = this.#repository().getConversationSummary(conversationId);
    if (!current) throw new ThreadHelmError('CONVERSATION_NOT_FOUND', 'Conversation not found.');
    if (current.state !== 'open') {
      throw new ThreadHelmError('INVALID_STATE', 'Only an open conversation can be paused.');
    }
    const summary = this.#repository().updateConversationState(
      conversationId,
      'paused',
      'USER_PAUSED',
      this.dependencies.clock().toISOString(),
    );
    this.dependencies.events.emit('coordination.conversationChanged', summary);
    return summary;
  }

  requestContentDeletion(conversationId: string): DeleteContentDisclosureView {
    this.#requireStarted();
    const summary = this.#repository().getConversationSummary(conversationId);
    if (!summary) throw new ThreadHelmError('CONVERSATION_NOT_FOUND', 'Conversation not found.');
    if (summary.state !== 'resolved' && summary.state !== 'closed') {
      throw new ThreadHelmError(
        'INVALID_STATE',
        'Only inactive (resolved or closed) conversations can be deleted.',
      );
    }
    const token = randomBytes(24).toString('hex');
    const expiresAt = this.dependencies.clock().getTime() + 5 * 60_000;
    this.#deletionTokens.set(token, { conversationId, expiresAt });
    return DeleteContentDisclosureView.parse({
      deletionToken: token,
      conversationId,
      handoffCount: summary.handoffCount,
      retainedContentBytes: this.#repository().getConversationRetainedContentBytes(conversationId),
      expiresAt: new Date(expiresAt).toISOString(),
    });
  }

  confirmContentDeletion(request: ConfirmDeleteContentRequest): ConversationSummaryView {
    this.#requireStarted();
    const snapshot = this.#deletionTokens.get(request.deletionToken);
    if (!snapshot || this.dependencies.clock().getTime() > snapshot.expiresAt) {
      throw new ThreadHelmError('INVALID_REQUEST', 'Deletion token is invalid or expired.');
    }
    this.#deletionTokens.delete(request.deletionToken);
    this.#repository().deleteConversationContent(
      snapshot.conversationId,
      this.dependencies.clock().toISOString(),
    );
    const summary = this.#repository().getConversationSummary(snapshot.conversationId)!;
    this.dependencies.events.emit('coordination.conversationChanged', summary);
    return summary;
  }

  #repository() {
    if (!this.dependencies.storage || this.dependencies.health?.degraded) {
      throw new ThreadHelmError('STORAGE_UNAVAILABLE', 'Coordination storage is unavailable.');
    }
    return this.dependencies.storage.repositories.coordination;
  }

  #disclosureService(): CoordinationDisclosures {
    if (!this.#disclosures) {
      throw new ThreadHelmError('INTERNAL', 'Coordination disclosures are not composed.');
    }
    return this.#disclosures;
  }

  #requireStarted(): void {
    if (!this.#started) throw new ThreadHelmError('INVALID_STATE', 'Coordination is not running.');
  }

  #publishLatest(handoffId: string): void {
    const event = this.#repository().latestEventForHandoff(handoffId);
    if (!event) return;
    this.publish(
      CoordinationEventEnvelope.parse({
        type: 'coordination.handoffChanged',
        eventId: event.id,
        conversationId: event.conversationId,
        handoffId: event.handoffId,
        sequence: event.sequence,
        kind: event.kind,
        reasonCode: event.reasonCode,
        safeSummary: event.safeSummary,
        occurredAt: event.occurredAt,
      }),
    );
  }
}

export function createCoordinationService(
  dependencies: CoordinationDependencies,
): CoordinationService {
  return new CoordinationServiceContainer(dependencies);
}

function toHandoffView(handoff: CoordinationHandoffRecord): HandoffView {
  return HandoffView.parse({
    id: handoff.id,
    conversationId: handoff.conversationId,
    inReplyToId: handoff.inReplyToId,
    senderSessionId: handoff.senderSessionId,
    recipientSessionId: handoff.recipientSessionId,
    origin: handoff.origin,
    kind: handoff.kind,
    responseExpected: handoff.requiresReply,
    deliveryState: handoff.deliveryState,
    workOutcome: handoff.workOutcome,
    holdReasonCode: handoff.holdReasonCode,
    purpose: handoff.purpose,
    body: handoff.body,
    createdAt: handoff.createdAt,
    updatedAt: handoff.updatedAt,
    deliveredAt: handoff.deliveredAt,
    acknowledgedAt: handoff.acknowledgedAt,
  });
}

function toHandoffSummaryView(handoff: CoordinationHandoffRecord): HandoffSummaryView {
  const summary = { ...toHandoffView(handoff) } as HandoffSummaryView & {
    purpose?: unknown;
    body?: unknown;
  };
  delete summary.purpose;
  delete summary.body;
  return HandoffSummaryView.parse(summary);
}

function toDeliveryAttemptView(attempt: DeliveryAttemptRecord): DeliveryAttemptView {
  return {
    id: attempt.id as DeliveryAttemptView['id'],
    handoffId: attempt.handoffId as DeliveryAttemptView['handoffId'],
    attemptNumber: attempt.attemptNumber,
    recipientSessionId: attempt.recipientSessionId,
    state: attempt.state,
    evidenceKind: attempt.evidenceKind,
    reasonCode: attempt.reasonCode,
    controlSequence: attempt.controlSequence,
    createdAt: attempt.createdAt,
    submittedAt: attempt.submittedAt,
    completedAt: attempt.completedAt,
  };
}
