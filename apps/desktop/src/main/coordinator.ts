/**
 * Composes every service into the router's handler table. Tests build a
 * Context with fakes and call these handlers through `createRouter`.
 */

import type { Handlers } from './ipc/router.js';
import type { Context } from './context.js';
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
import { approveWorkspace, listWorkspaces, revokeWorkspace } from './workspaces/service.js';

export function createHandlers(ctx: Context): Handlers {
  return {
    'workspaces.choose': () => chooseWorkspace(ctx),
    'workspaces.approve': ({ candidateToken }) => approveWorkspace(ctx, candidateToken),
    'workspaces.list': () => listWorkspaces(ctx),
    'workspaces.revoke': ({ workspaceId }) => revokeWorkspace(ctx, workspaceId),
    'providers.listReadiness': () => listReadiness(ctx),
    'sessions.previewLaunch': ({ workspaceId, providerId, terminal }) =>
      previewLaunch(ctx, workspaceId, providerId, terminal),
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
    'application.requestClose': () => requestClose(ctx),
    'application.stopAllAndClose': () => stopAllAndClose(ctx),
    'application.getInfo': () => ({ ...ctx.appInfo, storageDegraded: ctx.health.degraded }),
  };
}
