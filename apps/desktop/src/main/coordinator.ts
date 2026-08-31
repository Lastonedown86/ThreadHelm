/**
 * Composes every service into the router's handler table. Tests build a
 * Context with fakes and call these handlers through `createRouter`.
 */

import {
  CancelHandoffRequest,
  ConfirmAutoContinueRequest,
  PreviewHandoffRequest,
  PreviewAutoContinueRequest,
  PreviewRetargetRequest,
  ResolveEscalationRequest,
  ThreadHelmError,
  type ConversationState,
  type CoordinationEventEnvelope,
} from '@threadhelm/contracts';
import type { Handlers } from './ipc/router.js';
import type { Context } from './context.js';
import { createCoordinationService, type CoordinationService } from './coordination/service.js';
import { createMemoryService, type MemoryService } from './coordination/memory.js';
import { createProfileService, type ProfileService } from './coordination/profiles.js';
import {
  createAgentWizardService,
  type AgentWizardService,
} from './coordination/profile-wizard.js';
import { deliverHandoff } from './coordination/delivery.js';
import { createSupervisorService } from './coordination/supervisor.js';
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
  const memory = startMemory(ctx);
  const profiles = startProfiles(ctx);
  const supervisor = ctx.supervisor ?? createSupervisorService(ctx);
  ctx.supervisor = supervisor;
  ctx.coordinationBridge?.setSupervisorAuthority(supervisor);
  const agentWizard = ctx.storage && !ctx.health.degraded ? startAgentWizard(ctx, profiles) : null;
  const requireAgentWizard = () => {
    if (!agentWizard || !ctx.storage || ctx.health.degraded) {
      throw new ThreadHelmError('STORAGE_UNAVAILABLE', 'Agent-template storage is unavailable.');
    }
    return agentWizard;
  };
  return {
    'missions.eligibleSessions': () => supervisor.eligibleSessions(),
    'missions.preview': (request) => supervisor.preview(request),
    'missions.confirm': (request) => supervisor.confirm(request),
    'missions.list': (request) => supervisor.list(request),
    'missions.detail': ({ missionId }) => supervisor.detail(missionId),
    'missions.pause': ({ missionId }) => supervisor.pause(missionId),
    'missions.resume': (request) => supervisor.resume(request),
    'missions.cancel': ({ missionId }) => supervisor.cancel(missionId),
    'missions.previewRevision': (request) => supervisor.preview(request),
    'missions.confirmRevision': (request) => supervisor.confirm(request, true),
    'missions.workItem': (request) => supervisor.workItem(request),
    'missions.resolveEscalation': (request) => supervisor.resolveEscalation(request),
    'missions.previewDelete': ({ missionId }) => supervisor.previewDelete(missionId),
    'missions.confirmDelete': ({ previewToken }) => supervisor.confirmDelete(previewToken),
    'workspaces.choose': () => chooseWorkspace(ctx),
    'workspaces.approve': ({ candidateToken }) => approveWorkspace(ctx, candidateToken),
    'workspaces.list': () => listWorkspaces(ctx),
    'workspaces.revoke': ({ workspaceId }) => revokeWorkspace(ctx, workspaceId),
    'providers.listReadiness': () => listReadiness(ctx),
    'sessions.previewLaunch': ({
      workspaceId,
      providerId,
      terminal,
      runtimeSelection,
      workType,
      runtimeEscalationReason,
      permissionSelection,
      executionBounds,
    }) =>
      previewLaunch(
        ctx,
        workspaceId,
        providerId,
        terminal,
        runtimeSelection ?? { model: null, effort: null },
        permissionSelection ?? { policy: null, boundedAllowlist: [] },
        executionBounds,
        workType,
        runtimeEscalationReason,
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
    'coordination.previewAutoContinue': (request) =>
      coordination.previewAutoContinue(PreviewAutoContinueRequest.parse(request)),
    'coordination.confirmAutoContinue': (request) =>
      coordination.confirmAutoContinue(ConfirmAutoContinueRequest.parse(request)),
    'coordination.resolveEscalation': (request) =>
      coordination.resolveEscalation(ResolveEscalationRequest.parse(request)),
    'coordination.requestContentDeletion': ({ conversationId }) =>
      coordination.requestContentDeletion(conversationId),
    'coordination.confirmContentDeletion': (request) =>
      coordination.confirmContentDeletion(request),
    'memory.search': (request) => memory.search(request),
    'memory.get': (request) => memory.get(request),
    'memory.previewPublish': (request) => memory.previewPublish(request),
    'memory.confirmPublish': (request) => memory.confirmPublish(request),
    'memory.previewSupersede': (request) => memory.previewSupersede(request),
    'memory.confirmSupersede': (request) => memory.confirmSupersede(request),
    'memory.retract': (request) => memory.retract(request),
    'memory.resolveConflict': (request) => memory.resolveConflict(request),
    'memory.requestDeletion': (request) => memory.requestDeletion(request),
    'memory.confirmDeletion': (request) => memory.confirmDeletion(request),
    'profiles.chooseFile': () => profiles.chooseFile(),
    'profiles.previewImport': (request) => profiles.previewImport(request),
    'profiles.confirmImport': (request) => profiles.confirmImport(request),
    'profiles.list': (request) => profiles.list(request),
    'profiles.get': (request) => profiles.get(request),
    'profiles.setEnabled': (request) => profiles.setEnabled(request),
    'profiles.previewDelete': (request) => profiles.previewDelete(request),
    'profiles.confirmDelete': (request) => profiles.confirmDelete(request),
    'agentWizard.createDraft': (request) => requireAgentWizard().createDraft(request),
    'agentWizard.listDrafts': (request) => requireAgentWizard().listDrafts(request),
    'agentWizard.getDraft': (request) => requireAgentWizard().getDraft(request),
    'agentWizard.updateStep': (request) => requireAgentWizard().updateStep(request),
    'agentWizard.previewCompletion': (request) => requireAgentWizard().previewCompletion(request),
    'agentWizard.confirmProfile': (request) => requireAgentWizard().confirmProfile(request),
    'agentWizard.chooseExportTarget': () => requireAgentWizard().chooseExportTarget(),
    'agentWizard.previewExport': (request) => requireAgentWizard().previewExport(request),
    'agentWizard.confirmExport': (request) => requireAgentWizard().confirmExport(request),
    'agentWizard.deleteDraft': (request) => requireAgentWizard().deleteDraft(request),
    'agentTemplates.list': (request) => requireAgentWizard().listTemplates(request),
    'agentTemplates.get': (request) => requireAgentWizard().getTemplate(request),
    'agentTemplates.saveRevision': (request) => requireAgentWizard().saveRevision(request),
    'agentTemplates.duplicate': (request) => requireAgentWizard().duplicate(request),
    'agentTemplates.setEnabled': (request) => requireAgentWizard().setEnabled(request),
    'agentTemplates.previewDelete': (request) =>
      requireAgentWizard().previewDeleteTemplate(request),
    'agentTemplates.delete': (request) => requireAgentWizard().deleteTemplate(request),
    'application.requestClose': () => requestClose(ctx),
    'application.stopAllAndClose': () => stopAllAndClose(ctx),
    'application.getInfo': () => ({ ...ctx.appInfo, storageDegraded: ctx.health.degraded }),
  };
}

/** Compose the one main-owned reviewed-profile import and roster authority. */
export function startProfiles(ctx: Context): ProfileService {
  const service = ctx.profiles ?? createProfileService(ctx);
  ctx.profiles = service;
  return service;
}

/** Compose one non-executable wizard/template authority after profiles exist. */
export function startAgentWizard(ctx: Context, profiles = startProfiles(ctx)): AgentWizardService {
  const service = ctx.agentWizard ?? createAgentWizardService(ctx, profiles);
  ctx.agentWizard = service;
  return service;
}

/** Compose the one durable memory writer/search authority and bind provider tools to it. */
export function startMemory(ctx: Context): MemoryService {
  const service = ctx.memory ?? createMemoryService(ctx);
  ctx.memory = service;
  ctx.coordinationBridge?.setMemoryAuthority(service);
  return service;
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
  ctx.supervisor?.stop();
  ctx.coordination?.stop();
}

/** Strict, content-free fan-out; durable bodies never enter renderer event channels. */
export function fanOutCoordinationEvent(ctx: Context, event: CoordinationEventEnvelope): void {
  startCoordination(ctx).publish(event);
}
