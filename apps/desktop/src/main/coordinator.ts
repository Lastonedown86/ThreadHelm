/**
 * Composes every service into the router's handler table. Tests build a
 * Context with fakes and call these handlers through `createRouter`.
 */

import {
  CancelHandoffRequest,
  PreviewHandoffRequest,
  PreviewRetargetRequest,
  type ConversationState,
  type CoordinationEventEnvelope,
} from '@threadhelm/contracts';
import type { Handlers } from './ipc/router.js';
import type { Context } from './context.js';
import { createCoordinationService, type CoordinationService } from './coordination/service.js';
import { deliverHandoff } from './coordination/delivery.js';
import { requestClose, stopAllAndClose } from './lifecycle/close.js';
import { listReadiness } from './providers/readiness.js';
import { resolveRecovery } from './recovery/reconcile.js';
import { confirmForceStop, requestForceStop } from './sessions/force-stop.js';
import { resizeSession, selectSession, sendInput } from './sessions/input.js';
import { interruptSession } from './sessions/interrupt.js';
import { launchSession } from './sessions/launch.js';
import { previewLaunch } from './sessions/preview.js';
import { storageOf, toSessionView } from './sessions/registry.js';
import { confirmStop, requestStop } from './sessions/stop.js';
import { subscribeOutput } from './sessions/stream.js';
import { chooseWorkspace } from './workspaces/choose.js';
import { revalidateWorkspace } from './workspaces/identity.js';
import { approveWorkspace, listWorkspaces, revokeWorkspace } from './workspaces/service.js';

export function createHandlers(ctx: Context): Handlers {
  const coordination = startCoordination(ctx);
  return {
    'workspaces.choose': () => chooseWorkspace(ctx),
    'workspaces.approve': ({ candidateToken }) => approveWorkspace(ctx, candidateToken),
    'workspaces.list': () => listWorkspaces(ctx),
    'workspaces.revoke': ({ workspaceId }) => revokeWorkspace(ctx, workspaceId),
    'providers.listReadiness': () => listReadiness(ctx),
    'sessions.previewLaunch': ({ workspaceId, providerId, terminal, runtimeSelection }) =>
      previewLaunch(
        ctx,
        workspaceId,
        providerId,
        terminal,
        runtimeSelection ?? { model: null, effort: null },
      ),
    'sessions.launch': ({ previewToken, boundaryConfirmation }) =>
      launchSession(ctx, previewToken, boundaryConfirmation),
    'sessions.list': (request) => {
      const storage = storageOf(ctx);
      const options = request?.limit !== undefined ? { limit: request.limit } : {};
      return {
        sessions: storage.repositories.sessions.list(options).map((r) => toSessionView(ctx, r)),
        recoveryRecords: storage.repositories.recovery.listUnresolved(),
        storageDegraded: ctx.health.degraded,
      };
    },
    'sessions.events': ({ sessionId }) =>
      storageOf(ctx).repositories.events.listBySession(sessionId),
    'sessions.select': ({ sessionId }) => selectSession(ctx, sessionId),
    'sessions.interrupt': ({ sessionId }) => interruptSession(ctx, sessionId),
    'sessions.requestStop': ({ sessionId }) => requestStop(ctx, sessionId),
    'sessions.confirmStop': ({ stopToken }) => confirmStop(ctx, stopToken),
    'sessions.requestForceStop': ({ sessionId }) => requestForceStop(ctx, sessionId),
    'sessions.confirmForceStop': ({ forceToken }) => confirmForceStop(ctx, forceToken),
    'sessions.sendInput': ({ sessionId, bytes }) => sendInput(ctx, sessionId, bytes),
    'sessions.resize': ({ sessionId, columns, rows }) =>
      resizeSession(ctx, sessionId, columns, rows),
    'sessions.subscribeOutput': ({ sessionId }) => subscribeOutput(ctx, sessionId),
    'recovery.resolve': ({ recordId, resolution }) => resolveRecovery(ctx, recordId, resolution),
    'coordination.listHandoffs': (request) => coordination.listHandoffs(request?.limit),
    'coordination.previewHandoff': (request) =>
      coordination.previewHandoff(PreviewHandoffRequest.parse(request)),
    'coordination.confirmHandoff': (request) => coordination.confirmHandoff(request),
    'coordination.requestPresentation': ({ handoffId }) =>
      coordination.requestPresentation(handoffId),
    'coordination.confirmPresentation': (request) => coordination.confirmPresentation(request),
    'coordination.cancelHandoff': (request) =>
      coordination.cancelHandoff(CancelHandoffRequest.parse(request)),
    'coordination.previewRetarget': (request) =>
      coordination.previewRetarget(PreviewRetargetRequest.parse(request)),
    'coordination.confirmRetarget': (request) => coordination.confirmRetarget(request),
    'coordination.listConversations': (request) => {
      const opts: { state?: ConversationState; cursor?: string; limit?: number } = {};
      if (request?.state !== undefined) opts.state = request.state;
      if (request?.cursor !== undefined) opts.cursor = request.cursor;
      if (request?.limit !== undefined) opts.limit = request.limit;
      return coordination.listConversations(opts);
    },
    'coordination.getConversation': (request) => {
      const opts: { conversationId: string; cursor?: string; limit?: number } = {
        conversationId: request.conversationId,
      };
      if (request.cursor !== undefined) opts.cursor = request.cursor;
      if (request.limit !== undefined) opts.limit = request.limit;
      return coordination.getConversation(opts);
    },
    'coordination.pauseConversation': ({ conversationId }) =>
      coordination.pauseConversation(conversationId),
    'coordination.requestContentDeletion': ({ conversationId }) =>
      coordination.requestContentDeletion(conversationId),
    'coordination.confirmContentDeletion': (request) =>
      coordination.confirmContentDeletion(request),
    'application.requestClose': () => requestClose(ctx),
    'application.stopAllAndClose': () => stopAllAndClose(ctx),
    'application.getInfo': () => ({ ...ctx.appInfo, storageDegraded: ctx.health.degraded }),
  };
}

/** Compose the single main-owned coordination authority for this application run. */
export function startCoordination(ctx: Context): CoordinationService {
  const service =
    ctx.coordination ??
    createCoordinationService({
      clock: ctx.clock,
      storage: ctx.storage,
      events: ctx.events,
      sessions: ctx.live,
      health: ctx.health,
      selection: ctx.selection,
      adapters: ctx.adapters,
      isSessionWorkspaceApproved: (sessionId, workspaceId) => {
        const session = ctx.storage?.repositories.sessions.findById(sessionId);
        const workspace = ctx.storage?.repositories.workspaces.findById(workspaceId);
        if (!session || session.workspaceId !== workspaceId || !workspace || workspace.revokedAt) {
          return false;
        }
        try {
          revalidateWorkspace(ctx, workspace);
          return true;
        } catch {
          return false;
        }
      },
      submitDelivery: (snapshot) => deliverHandoff(ctx, snapshot),
      isBridgeHealthy: (sessionId) =>
        ctx.coordinationBridge?.hasValidCredential(sessionId) === true,
    });
  ctx.coordination = service;
  service.start();
  return service;
}

export function stopCoordination(ctx: Context): void {
  ctx.coordination?.stop();
}

/** Strict, content-free fan-out; durable bodies never enter renderer event channels. */
export function fanOutCoordinationEvent(ctx: Context, event: CoordinationEventEnvelope): void {
  startCoordination(ctx).publish(event);
}
