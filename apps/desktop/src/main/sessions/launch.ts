/**
 * Launch orchestration (T044). Strict order, fail closed at every step:
 *
 *  1. consume the preview token; require the per-session boundary confirmation
 *  2. revalidate workspace identity and provider readiness
 *  3. acquire the one-writer lease
 *  4. durable `starting` record + readiness snapshot + event, one transaction
 *  5. create the KILL_ON_JOB_CLOSE Job Object
 *  6. start a dormant host, bootstrap it, wait for `host.ready`
 *  7. assign the host pid, verify membership, verify the job holds only it
 *  8. build + validate the adapter's launch descriptor, send it with the port
 *  9. wait for `host.launched`, verify the provider root is in the job
 * 10. transition to `running`
 *
 * Any failure after step 3 rolls back: scope terminated, session `failed`,
 * lease released. No provider process can exist outside a verified job.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import {
  LaunchDescriptor,
  PROTOCOL_VERSION,
  ThreadHelmError,
  type HostToMainMessage,
  type SessionView,
} from '@threadhelm/contracts';
import { safeTemplate } from '@threadhelm/persistence';
import type { SessionBridgeConfig } from '@threadhelm/providers';
import { now, type Context, type LiveSession } from '../context.js';
import { failSession } from './failure.js';
import { attachHost } from './host-events.js';
import { acquireLease, releaseLease } from './lease.js';
import { revalidatePreview } from './preview.js';
import { sessionView, storageOf, transition } from './registry.js';

const HOST_READY_TIMEOUT_MS = 10_000;
const HOST_LAUNCH_TIMEOUT_MS = 20_000;

type Ready = Extract<HostToMainMessage, { type: 'host.ready' }>;
type Launched = Extract<HostToMainMessage, { type: 'host.launched' }>;
export interface MissionLaunchAuthorization {
  missionId: string;
  leaseId: string;
  sessionId: string;
}

function deferred<T>(timeoutMs: number, code: string) {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const timer = setTimeout(() => reject(new Error(code)), timeoutMs);
  return {
    promise: promise.finally(() => clearTimeout(timer)),
    resolve,
    reject,
  };
}

function supervisionFailure(reason: string): ThreadHelmError {
  return new ThreadHelmError(
    'SUPERVISION_FAILED',
    'ThreadHelm could not prove the session would be contained, so it did not start the agent.',
    { reason },
  );
}

export async function launchSession(
  ctx: Context,
  previewToken: string,
  boundaryConfirmation: boolean,
  missionAuthorization?: MissionLaunchAuthorization,
): Promise<SessionView> {
  const preview = ctx.tokens.previews.take(previewToken);
  if (!preview) {
    throw new ThreadHelmError('PREVIEW_EXPIRED', 'The launch preview expired. Open it again.');
  }
  if (!boundaryConfirmation) {
    throw new ThreadHelmError(
      'CONFIRMATION_REQUIRED',
      'Confirm the access boundary disclosure to launch this session.',
    );
  }
  ctx.health.assertWritable();
  const storage = storageOf(ctx);
  if (missionAuthorization) {
    if (!ctx.supervisor) throw new ThreadHelmError('WORKER_AUTOSTART_NOT_AUTHORIZED');
    ctx.supervisor.assertLaunchAuthorized(missionAuthorization, preview);
  }
  const { workspace, readiness, result } = await revalidatePreview(ctx, preview);
  if (missionAuthorization) ctx.supervisor!.assertLaunchAuthorized(missionAuthorization, preview);
  const adapter = ctx.adapters.find((candidate) => candidate.id === preview.providerId);
  if (!adapter || !result.resolvedExecutable || !result.executableKind || !readiness.version) {
    throw new ThreadHelmError('PROVIDER_UNAVAILABLE', 'The provider is not ready to launch.');
  }

  const sessionId = missionAuthorization?.sessionId ?? randomUUID();
  acquireLease(ctx, workspace.identity, sessionId);

  // 4. durable starting record before any OS process exists
  const createdAt = now(ctx);
  try {
    ctx.health.required(() =>
      storage.repositories.transaction(() => {
        const snapshot = storage.repositories.readiness.insert({
          providerId: adapter.id,
          resolvedExecutable: readiness.resolvedExecutable,
          version: readiness.version,
          availability: readiness.availability,
          authentication: readiness.authentication,
          probedAt: readiness.probedAt,
          reasonCode: readiness.reasonCode,
          safeSummary: readiness.safeSummary,
        });
        storage.repositories.sessions.insertStarting({
          id: sessionId,
          workspaceId: preview.workspaceId,
          definitionId: adapter.id,
          readinessSnapshotId: snapshot.id,
          columns: preview.terminal.columns,
          rows: preview.terminal.rows,
          createdAt,
        });
        if (missionAuthorization) ctx.supervisor!.bindStartingSession(missionAuthorization);
        storage.repositories.events.append(sessionId, {
          kind: 'launch_requested',
          fromState: null,
          toState: 'starting',
          actor: 'user',
          reasonCode: null,
          safeSummary: safeTemplate('launch_requested', { provider: adapter.displayName }),
          occurredAt: createdAt,
        });
      }),
    );
  } catch (error) {
    releaseLease(ctx, sessionId);
    throw error;
  }
  ctx.events.emit('session.changed', {
    session: sessionView(ctx, sessionId),
    reasonCode: 'LAUNCH_REQUESTED',
    sequence: 1,
  });

  // 5–9. supervision
  let live: LiveSession | undefined;
  try {
    const jobToken = ctx.jobs.create(sessionId);
    const host = ctx.hosts.spawn(sessionId);
    live = {
      launchSnapshot: structuredClone(preview),
      id: sessionId,
      workspaceId: preview.workspaceId,
      identity: workspace.identity,
      canonicalPath: workspace.canonicalPath,
      providerId: adapter.id,
      adapter,
      readiness,
      host,
      jobToken,
      hostPid: 0,
      rootPid: null,
      terminal: preview.terminal,
      state: 'starting',
      forceStopAvailable: false,
      controlSequence: 0,
      pendingControls: new Map(),
      rendererPort: null,
      exit: null,
      interrupt: null,
      stop: null,
    };
    ctx.live.set(sessionId, live);

    const ready = deferred<Ready>(HOST_READY_TIMEOUT_MS, 'HOST_READY_TIMEOUT');
    const launched = deferred<Launched>(HOST_LAUNCH_TIMEOUT_MS, 'HOST_LAUNCH_TIMEOUT');
    // A failure before launch rejects both; only one is awaited at a time.
    void launched.promise.catch(() => undefined);
    void ready.promise.catch(() => undefined);
    attachHost(ctx, live, {
      ready: ready.resolve,
      launched: launched.resolve,
      failure: (message) => {
        ready.reject(new Error(message.code));
        launched.reject(new Error(message.code));
      },
    });

    const bootstrapSecret = randomBytes(24).toString('base64url');
    host.postMessage({
      type: 'host.bootstrap',
      sessionId,
      protocolVersion: PROTOCOL_VERSION,
      bootstrapSecret,
    });
    const readyMessage = await ready.promise;
    if (readyMessage.protocolVersion !== PROTOCOL_VERSION)
      throw new Error('HOST_PROTOCOL_MISMATCH');
    if (host.pid !== undefined && host.pid !== readyMessage.hostPid)
      throw new Error('HOST_PID_MISMATCH');
    live.hostPid = readyMessage.hostPid;

    // 7. containment proven before anything may be launched
    if (ctx.native.inspectJob(jobToken).activeProcessCount !== 0)
      throw new Error('JOB_NOT_EMPTY_BEFORE_ASSIGN');
    ctx.native.assignProcess(jobToken, live.hostPid);
    if (!ctx.native.verifyProcessInJob(jobToken, live.hostPid))
      throw new Error('PROCESS_NOT_IN_JOB');
    if (ctx.native.inspectJob(jobToken).activeProcessCount !== 1)
      throw new Error('JOB_SCOPE_UNEXPECTED');
    ctx.log.info('session.host_contained', { sessionId, hostPid: live.hostPid });

    // 8. adapter-owned descriptor, validated, cwd pinned to the canonical path
    let bridgeConfig: SessionBridgeConfig | undefined;
    if (
      adapter.capabilities.bridgeConfiguration === 'session_scoped_stdio_mcp' &&
      ctx.coordinationBridge
    ) {
      try {
        bridgeConfig = await ctx.coordinationBridge.prepareSession(
          sessionId,
          adapter.id,
          readiness.version,
        );
      } catch {
        ctx.log.warn('coordination.bridge_unavailable', {
          sessionId,
          reasonCode: 'COORDINATION_BRIDGE_UNAVAILABLE',
        });
        if (missionAuthorization) throw new ThreadHelmError('WORKER_AUTOSTART_PREFLIGHT_FAILED');
      }
    }
    if (missionAuthorization && !bridgeConfig)
      throw new ThreadHelmError('WORKER_AUTOSTART_PREFLIGHT_FAILED');
    const descriptor = LaunchDescriptor.parse(
      adapter.buildLaunch({
        sessionId,
        // Identity is handle-based (canonicalPath); the process itself gets the
        // Win32 display form because CreateProcess/Node reject a \? cwd.
        canonicalWorkspacePath: workspace.displayPath,
        resolvedExecutable: result.resolvedExecutable,
        executableKind: result.executableKind,
        terminal: preview.terminal,
        version: readiness.version,
        runtimeSelection: preview.runtimeSelection,
        permissionResolution: preview.permissionResolution,
        executionBounds: preview.executionBounds,
        ...(bridgeConfig ? { bridgeConfig } : {}),
        ...(missionAuthorization
          ? { profileBinding: ctx.supervisor!.profileLaunchBinding(missionAuthorization) }
          : {}),
        ...(preview.reconOutputDirectory
          ? { reconOutputDirectory: preview.reconOutputDirectory }
          : {}),
      }),
    );
    if (descriptor.cwd !== workspace.displayPath) throw new Error('DESCRIPTOR_CWD_MISMATCH');

    const channel = ctx.channels.create();
    live.rendererPort = channel.rendererPort;
    if (missionAuthorization) {
      ctx.supervisor!.assertLaunchAuthorized(missionAuthorization, preview);
      ctx.supervisor!.markLaunchDispatched(missionAuthorization);
    }
    host.postMessage(
      {
        type: 'host.launch',
        sessionId,
        protocolVersion: PROTOCOL_VERSION,
        bootstrapSecret,
        descriptor,
        ...(missionAuthorization
          ? { outputBudget: ctx.supervisor!.outputLaunchBudget(missionAuthorization) }
          : {}),
      },
      [channel.hostPort],
    );
    const launchedMessage = await launched.promise;
    live.rootPid = launchedMessage.rootPid;
    if (!ctx.native.verifyProcessInJob(jobToken, live.rootPid)) throw new Error('ROOT_NOT_IN_JOB');

    // 10. running
    return transition(ctx, sessionId, {
      to: 'running',
      actor: 'threadhelm',
      kind: 'launched',
      reasonCode: null,
      summary: safeTemplate('launched', { provider: adapter.displayName, pid: live.rootPid }),
      patch: { hostPid: live.hostPid, rootPid: live.rootPid, startedAt: now(ctx) },
    });
  } catch (error) {
    const candidate = error instanceof Error ? error.message.split(' ')[0]! : '';
    // Typed errors carry a fixed code. Their user-facing sentence is never an
    // event reason: a word such as "The" would fail the strict event schema
    // after the lifecycle write and could interrupt cleanup.
    const reason =
      error instanceof ThreadHelmError
        ? error.code
        : /^[A-Z][A-Z0-9_]{2,63}$/.test(candidate)
          ? candidate
          : 'SUPERVISION_FAILED';
    ctx.log.error('session.launch_failed', { sessionId, reason });
    if (live) {
      failSession(ctx, live, reason);
    } else {
      ctx.jobs.close(sessionId);
      releaseLease(ctx, sessionId);
      ctx.health.bestEffort(() =>
        transition(ctx, sessionId, {
          to: 'failed',
          actor: 'threadhelm',
          kind: 'state_changed',
          reasonCode: reason,
          summary: safeTemplate('session_failed', { reason }),
          patch: { endedAt: now(ctx) },
        }),
      );
    }
    throw error instanceof ThreadHelmError ? error : supervisionFailure(reason);
  }
}
