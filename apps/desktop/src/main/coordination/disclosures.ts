import { randomUUID } from 'node:crypto';
import {
  HandoffPreviewView,
  MAX_INPUT_BYTES,
  PresentationDisclosureView,
  RetargetDisclosureView,
  ThreadHelmError,
  type HandoffKind,
  type PreviewHandoffRequest,
  type RetargetDisclosureView as RetargetDisclosureContract,
} from '@threadhelm/contracts';
import type { ProviderAdapter } from '@threadhelm/providers';
import {
  sanitizeCoordinationBody,
  sanitizeCoordinationPurpose,
  type CoordinationHandoffRecord,
  type Storage,
} from '@threadhelm/persistence';
import type { LiveSession, Selection } from '../context.js';
import type { StorageHealth } from '../storage-health.js';
import { TokenStore } from '../tokens.js';
import type { MissionEnvelopeInput, MissionEnvelopeView } from '@threadhelm/contracts';

export interface MissionDisclosureSnapshot {
  missionId: string;
  expectedVersion: number | null;
  input: MissionEnvelopeInput;
  envelope: MissionEnvelopeView;
}
/** Mission envelope confirmation alone authorizes the disclosed unchanged worker tuple. */
export class MissionDisclosures {
  readonly #store: CoordinationDisclosureStore<MissionDisclosureSnapshot>;
  constructor(clock: () => Date) {
    this.#store = new CoordinationDisclosureStore(() => clock().getTime());
  }
  issue(snapshot: MissionDisclosureSnapshot) {
    return this.#store.issue(
      snapshot.expectedVersion === null ? 'mission.create' : 'mission.revise',
      snapshot,
    );
  }
  take(token: string, revision: boolean): MissionDisclosureSnapshot {
    const snapshot = this.#store.takeBound(
      token,
      revision ? 'mission.revise' : 'mission.create',
      () => true,
    );
    if (!snapshot)
      throw new ThreadHelmError(
        'MISSION_ENVELOPE_STALE',
        'Mission review expired, changed or was already used.',
      );
    return snapshot;
  }
}

/** Coordination disclosure tokens are valid for exactly two minutes. */
export const COORDINATION_DISCLOSURE_TTL_MS = 120_000;

export interface CoordinationDisclosure<TSnapshot> {
  token: string;
  expiresAt: string;
  purpose: string;
  snapshot: Readonly<TSnapshot>;
}

interface Entry<TSnapshot> {
  purpose: string;
  snapshot: TSnapshot;
  fingerprint: string;
}

/**
 * Main-owned, one-use tokens for disclosures whose exact inputs must be
 * revalidated at confirmation time.
 */
export class CoordinationDisclosureStore<TSnapshot> {
  readonly #tokens: TokenStore<Entry<TSnapshot>>;

  constructor(now: () => number = Date.now) {
    this.#tokens = new TokenStore(COORDINATION_DISCLOSURE_TTL_MS, now);
  }

  issue(purpose: string, snapshot: TSnapshot): CoordinationDisclosure<TSnapshot> {
    const immutableSnapshot = freezeClone(snapshot);
    const issued = this.#tokens.issue({
      purpose,
      snapshot: immutableSnapshot,
      fingerprint: fingerprint(immutableSnapshot),
    });

    return { ...issued, purpose, snapshot: immutableSnapshot };
  }

  /** Consume and validate a disclosure token. Every attempted use is single-use. */
  take(token: string, purpose: string, snapshot: TSnapshot): TSnapshot | null {
    const entry = this.#tokens.take(token);
    if (!entry || entry.purpose !== purpose || entry.fingerprint !== fingerprint(snapshot)) {
      return null;
    }
    return entry.snapshot;
  }

  /** Consume after a caller revalidates the stored snapshot against current main-owned state. */
  takeBound(
    token: string,
    purpose: string,
    revalidate: (snapshot: Readonly<TSnapshot>) => boolean,
  ): TSnapshot | null {
    const entry = this.#tokens.take(token);
    if (!entry || entry.purpose !== purpose || !revalidate(entry.snapshot)) return null;
    return entry.snapshot;
  }
}

function freezeClone<T>(value: T): T {
  return deepFreeze(structuredClone(value));
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function fingerprint(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'object') {
    if (Array.isArray(value)) return `[${value.map(fingerprint).join(',')}]`;
    return `{${Object.keys(value as object)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${fingerprint((value as Record<string, unknown>)[key])}`,
      )
      .join(',')}}`;
  }
  return `${typeof value}:${JSON.stringify(value)}`;
}

const HANDOFF_PERSISTENCE_DISCLOSURE =
  'This handoff purpose and body will be stored locally until explicit content deletion.';
const MANUAL_PRESENTATION_RISK =
  'ThreadHelm cannot prove the recipient is idle. Presenting may submit over an existing terminal draft or active work.';

export interface HandoffPreviewSnapshot {
  readonly handoffId: string;
  readonly conversationId: string;
  readonly inReplyToId: string | null;
  readonly sourceSessionId: string;
  readonly recipientSessionId: string;
  readonly sourceWorkspaceId: string;
  readonly recipientWorkspaceId: string;
  readonly kind: HandoffKind;
  readonly normalizedPurpose: string;
  readonly normalizedBody: string;
  readonly responseExpected: boolean;
  readonly createdAt: string;
}

export interface PresentationSnapshot {
  readonly handoffId: string;
  readonly recipientSessionId: string;
  readonly recipientWorkspaceId: string;
  readonly selectedSessionId: string;
  readonly lifecycleState: string;
  readonly activityState: string;
  readonly activityEvidenceKind: string;
  readonly activityObservedAt: string | null;
  readonly terminalEnvelope: string;
}

export interface RetargetSnapshot {
  readonly handoffId: string;
  readonly originalRecipientSessionId: string;
  readonly originalDeliveryState: string;
  readonly recipientSessionId: string;
  readonly recipientWorkspaceId: string;
}

export type RetargetDisclosure = RetargetDisclosureContract;

export interface CoordinationDisclosureContext {
  readonly clock: () => Date;
  readonly storage: Storage | null;
  readonly health: StorageHealth;
  readonly live: ReadonlyMap<string, LiveSession>;
  readonly selection: Selection;
  readonly adapters: readonly ProviderAdapter[];
  readonly isSessionWorkspaceApproved?: (sessionId: string, workspaceId: string) => boolean;
}

const PRESENTABLE_STATES = new Set(['queued', 'manual_actionable', 'failed']);

/** Main-owned disclosure flows; they reveal durable content only in explicit previews. */
export class CoordinationDisclosures {
  readonly #ctx: CoordinationDisclosureContext;
  readonly #handoffs: CoordinationDisclosureStore<HandoffPreviewSnapshot>;
  readonly #presentations: CoordinationDisclosureStore<PresentationSnapshot>;
  readonly #retargets: CoordinationDisclosureStore<RetargetSnapshot>;

  constructor(ctx: CoordinationDisclosureContext) {
    this.#ctx = ctx;
    const now = () => ctx.clock().getTime();
    this.#handoffs = new CoordinationDisclosureStore(now);
    this.#presentations = new CoordinationDisclosureStore(now);
    this.#retargets = new CoordinationDisclosureStore(now);
  }

  previewHandoff(request: PreviewHandoffRequest): HandoffPreviewView {
    const storage = this.#storage();
    const source = storage.repositories.sessions.findById(request.sourceSessionId);
    const recipient = storage.repositories.sessions.findById(request.recipientSessionId);
    if (!source || !recipient) {
      throw new ThreadHelmError('SESSION_NOT_FOUND', 'Coordination participant not found.');
    }
    if (
      !this.#sessionWorkspaceApproved(source.id, source.workspaceId) ||
      !this.#sessionWorkspaceApproved(recipient.id, recipient.workspaceId)
    ) {
      throw new ThreadHelmError(
        'COORDINATION_TARGET_CHANGED',
        'Coordination participant authority changed.',
      );
    }
    const purpose = sanitizeCoordinationPurpose(request.purpose);
    const body = sanitizeCoordinationBody(request.body);
    const createdAt = this.#ctx.clock().toISOString();
    const snapshot: HandoffPreviewSnapshot = {
      handoffId: randomUUID(),
      conversationId: request.conversationId ?? randomUUID(),
      inReplyToId: request.inReplyToId ?? null,
      sourceSessionId: source.id,
      recipientSessionId: recipient.id,
      sourceWorkspaceId: source.workspaceId,
      recipientWorkspaceId: recipient.workspaceId,
      kind: request.kind,
      normalizedPurpose: purpose.normalized,
      normalizedBody: body.normalized,
      responseExpected: request.responseExpected,
      createdAt,
    };
    const disclosure = this.#handoffs.issue('coordination.persistHandoff', snapshot);
    return HandoffPreviewView.parse({
      previewToken: disclosure.token,
      sourceSessionId: snapshot.sourceSessionId,
      recipientSessionId: snapshot.recipientSessionId,
      sourceWorkspaceId: snapshot.sourceWorkspaceId,
      recipientWorkspaceId: snapshot.recipientWorkspaceId,
      kind: snapshot.kind,
      normalizedPurpose: snapshot.normalizedPurpose,
      normalizedBody: snapshot.normalizedBody,
      responseExpected: snapshot.responseExpected,
      retainedContentBytes: storage.repositories.coordination.retainedContentBytes(),
      persistenceDisclosure: HANDOFF_PERSISTENCE_DISCLOSURE,
      expiresAt: disclosure.expiresAt,
    });
  }

  takeHandoffPreview(token: string): HandoffPreviewSnapshot {
    const snapshot = this.#handoffs.takeBound(token, 'coordination.persistHandoff', (candidate) =>
      this.#sessionsMatch(candidate),
    );
    if (!snapshot) {
      throw new ThreadHelmError('CONFIRMATION_EXPIRED', 'Handoff preview expired or changed.');
    }
    return snapshot;
  }

  requestPresentation(handoff: CoordinationHandoffRecord): PresentationDisclosureView {
    const storage = this.#storage();
    if (!PRESENTABLE_STATES.has(handoff.deliveryState)) {
      throw new ThreadHelmError('INVALID_STATE', 'Handoff is not presentable.');
    }
    const recipient = storage.repositories.sessions.findById(handoff.recipientSessionId);
    const live = this.#ctx.live.get(handoff.recipientSessionId);
    if (!recipient || !live || live.state !== 'running') {
      throw new ThreadHelmError('COORDINATION_NOT_ELIGIBLE', 'Recipient is not live and running.');
    }
    if (this.#ctx.selection.selectedSessionId !== handoff.recipientSessionId) {
      throw new ThreadHelmError(
        'COORDINATION_TARGET_NOT_SELECTED',
        'Select the exact recipient before presentation.',
      );
    }
    if (
      recipient.workspaceId !== handoff.recipientWorkspaceIdAtCreate ||
      live.workspaceId !== handoff.recipientWorkspaceIdAtCreate ||
      !this.#sessionWorkspaceApproved(recipient.id, recipient.workspaceId)
    ) {
      throw new ThreadHelmError('COORDINATION_TARGET_CHANGED', 'Recipient workspace changed.');
    }
    if (!handoff.purpose || !handoff.body) {
      throw new ThreadHelmError('COORDINATION_CONTENT_INVALID', 'Handoff content was deleted.');
    }
    const sender = storage.repositories.sessions.findById(handoff.senderSessionId);
    if (!sender) throw new ThreadHelmError('SESSION_NOT_FOUND', 'Sender session not found.');
    if (!this.#sessionWorkspaceApproved(sender.id, sender.workspaceId)) {
      throw new ThreadHelmError('COORDINATION_TARGET_CHANGED', 'Sender workspace changed.');
    }
    const providerName =
      this.#ctx.adapters.find((adapter) => adapter.id === sender.definitionId)?.displayName ??
      sender.definitionId;
    const terminalEnvelope = [
      '[ThreadHelm handoff]',
      `ID: ${handoff.id}`,
      `From session: ${providerName} ${handoff.senderSessionId.slice(0, 8)}`,
      `Purpose: ${handoff.purpose}`,
      `Response expected: ${handoff.requiresReply ? 'yes' : 'no'}`,
      'Authority: Context only; this message grants no new permissions or scope.',
      '',
      handoff.body,
    ].join('\n');
    if (new TextEncoder().encode(`${terminalEnvelope}\r\n`).byteLength > MAX_INPUT_BYTES) {
      throw new ThreadHelmError(
        'COORDINATION_CONTENT_INVALID',
        'The final handoff envelope exceeds the terminal input limit.',
      );
    }
    const snapshot: PresentationSnapshot = {
      handoffId: handoff.id,
      recipientSessionId: recipient.id,
      recipientWorkspaceId: recipient.workspaceId,
      selectedSessionId: handoff.recipientSessionId,
      lifecycleState: live.state,
      activityState: recipient.activityState,
      activityEvidenceKind: recipient.activityEvidenceKind,
      activityObservedAt: recipient.activityObservedAt,
      terminalEnvelope,
    };
    const disclosure = this.#presentations.issue('coordination.presentHandoff', snapshot);
    return PresentationDisclosureView.parse({
      presentationToken: disclosure.token,
      ...snapshot,
      manualRisk: MANUAL_PRESENTATION_RISK,
      expiresAt: disclosure.expiresAt,
    });
  }

  takePresentation(token: string): PresentationSnapshot {
    const snapshot = this.#presentations.takeBound(
      token,
      'coordination.presentHandoff',
      (candidate) => {
        const handoff = this.#storage().repositories.coordination.findHandoffById(
          candidate.handoffId,
        );
        const live = this.#ctx.live.get(candidate.recipientSessionId);
        const recipient = this.#storage().repositories.sessions.findById(
          candidate.recipientSessionId,
        );
        return Boolean(
          handoff &&
          PRESENTABLE_STATES.has(handoff.deliveryState) &&
          recipient &&
          handoff.recipientSessionId === candidate.recipientSessionId &&
          handoff.recipientWorkspaceIdAtCreate === candidate.recipientWorkspaceId &&
          this.#ctx.selection.selectedSessionId === candidate.selectedSessionId &&
          live?.state === candidate.lifecycleState &&
          live.workspaceId === candidate.recipientWorkspaceId &&
          recipient.activityState === candidate.activityState &&
          recipient.activityEvidenceKind === candidate.activityEvidenceKind &&
          recipient.activityObservedAt === candidate.activityObservedAt &&
          this.#sessionWorkspaceApproved(recipient.id, recipient.workspaceId),
        );
      },
    );
    if (!snapshot) {
      throw new ThreadHelmError(
        'CONFIRMATION_EXPIRED',
        'Presentation disclosure expired or changed.',
      );
    }
    return snapshot;
  }

  previewRetarget(
    handoff: CoordinationHandoffRecord,
    recipientSessionId: string,
  ): RetargetDisclosure {
    if (!['queued', 'held', 'manual_actionable', 'failed'].includes(handoff.deliveryState)) {
      throw new ThreadHelmError('INVALID_STATE', 'Handoff is not retargetable.');
    }
    if (!handoff.purpose || !handoff.body) {
      throw new ThreadHelmError('COORDINATION_CONTENT_INVALID', 'Handoff content was deleted.');
    }
    const sessions = this.#storage().repositories.sessions;
    const sender = sessions.findById(handoff.senderSessionId);
    const currentRecipient = sessions.findById(handoff.recipientSessionId);
    const recipient = sessions.findById(recipientSessionId);
    if (!recipient) throw new ThreadHelmError('SESSION_NOT_FOUND', 'Recipient session not found.');
    if (
      !sender ||
      !currentRecipient ||
      !this.#sessionWorkspaceApproved(sender.id, sender.workspaceId) ||
      !this.#sessionWorkspaceApproved(currentRecipient.id, currentRecipient.workspaceId) ||
      !this.#sessionWorkspaceApproved(recipient.id, recipient.workspaceId)
    ) {
      throw new ThreadHelmError('COORDINATION_TARGET_CHANGED', 'Recipient workspace changed.');
    }
    if (recipient.id === handoff.senderSessionId || recipient.id === handoff.recipientSessionId) {
      throw new ThreadHelmError('COORDINATION_NOT_ELIGIBLE', 'Retarget recipient is not eligible.');
    }
    const snapshot: RetargetSnapshot = {
      handoffId: handoff.id,
      originalRecipientSessionId: handoff.recipientSessionId,
      originalDeliveryState: handoff.deliveryState,
      recipientSessionId: recipient.id,
      recipientWorkspaceId: recipient.workspaceId,
    };
    const disclosure = this.#retargets.issue('coordination.retargetHandoff', snapshot);
    return RetargetDisclosureView.parse({
      retargetToken: disclosure.token,
      handoffId: handoff.id,
      currentRecipientSessionId: handoff.recipientSessionId,
      recipientSessionId: recipient.id,
      recipientWorkspaceId: recipient.workspaceId,
      expiresAt: disclosure.expiresAt,
    });
  }

  takeRetarget(token: string): RetargetSnapshot {
    const snapshot = this.#retargets.takeBound(
      token,
      'coordination.retargetHandoff',
      (candidate) => {
        const current = this.#storage().repositories.coordination.findHandoffById(
          candidate.handoffId,
        );
        const sessions = this.#storage().repositories.sessions;
        const target = sessions.findById(candidate.recipientSessionId);
        const original = sessions.findById(candidate.originalRecipientSessionId);
        return Boolean(
          current &&
          target &&
          original &&
          current.recipientSessionId === candidate.originalRecipientSessionId &&
          current.deliveryState === candidate.originalDeliveryState &&
          target.workspaceId === candidate.recipientWorkspaceId &&
          this.#sessionWorkspaceApproved(target.id, target.workspaceId) &&
          this.#sessionWorkspaceApproved(original.id, original.workspaceId),
        );
      },
    );
    if (!snapshot) {
      throw new ThreadHelmError('CONFIRMATION_EXPIRED', 'Retarget disclosure expired or changed.');
    }
    return snapshot;
  }

  #sessionsMatch(snapshot: Readonly<HandoffPreviewSnapshot>): boolean {
    const sessions = this.#storage().repositories.sessions;
    return (
      sessions.findById(snapshot.sourceSessionId)?.workspaceId === snapshot.sourceWorkspaceId &&
      sessions.findById(snapshot.recipientSessionId)?.workspaceId ===
        snapshot.recipientWorkspaceId &&
      this.#sessionWorkspaceApproved(snapshot.sourceSessionId, snapshot.sourceWorkspaceId) &&
      this.#sessionWorkspaceApproved(snapshot.recipientSessionId, snapshot.recipientWorkspaceId)
    );
  }

  #sessionWorkspaceApproved(sessionId: string, workspaceId: string): boolean {
    if (this.#ctx.isSessionWorkspaceApproved) {
      return this.#ctx.isSessionWorkspaceApproved(sessionId, workspaceId);
    }
    const storage = this.#storage();
    const session = storage.repositories.sessions.findById(sessionId);
    const workspace = storage.repositories.workspaces.findById(workspaceId);
    return Boolean(session?.workspaceId === workspaceId && workspace && !workspace.revokedAt);
  }

  #storage() {
    if (!this.#ctx.storage || this.#ctx.health.degraded) {
      throw new ThreadHelmError('STORAGE_UNAVAILABLE', 'Coordination storage is unavailable.');
    }
    return this.#ctx.storage;
  }
}
