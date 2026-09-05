/**
 * Coordinator bootstrap (T029, T082).
 *
 * Order matters: single-instance lock → hardening → storage (userData SQLite)
 * → startup reconciliation → window + router → power events. A second launch
 * never reaches storage or supervision; it focuses the existing controller.
 * On quit every retained Job Object handle is closed, which terminates any
 * scope that somehow survived (KILL_ON_JOB_CLOSE).
 */

import { app, powerMonitor, type BrowserWindow } from 'electron';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ThreadHelmError } from '@threadhelm/contracts';
import { ControllerLeases } from '@threadhelm/domain';
import { openStorage, type Storage } from '@threadhelm/persistence';
import { builtInAdapters } from '@threadhelm/providers';
import * as native from '@threadhelm/windows-supervisor';
import type { Context } from './context.js';
import { createHandlers, stopCoordination } from './coordinator.js';
import { BridgeSessionManager } from './coordination/bridge.js';
import { presentNextAtSafePoint, publishLatest } from './coordination/delivery.js';
import { reconcileCoordinationAtStartup } from './coordination/recovery.js';
import {
  electronChannels,
  electronAgentExportTargetPicker,
  electronHostSpawner,
  electronPicker,
  electronProfileFilePicker,
} from './electron-adapters.js';
import { bindRouter, createRendererEvents } from './ipc/electron-binding.js';
import { createRouter } from './ipc/router.js';
import { cancelClose, requestClose } from './lifecycle/close.js';
import { createLogger, multiSink, stderrSink, type LogSink } from './logging.js';
import { JobRegistry } from './native/job-registry.js';
import { createProbeRunner } from './providers/readiness.js';
import { createStructuredDraftRunner } from './providers/structured-draft.js';
import { attachPowerEvents } from './recovery/power-events.js';
import { reconcileAtStartup } from './recovery/reconcile.js';
import { StorageHealth } from './storage-health.js';
import { installTestHooks, testHooksEnabled } from './test-hooks.js';
import { TokenStore } from './tokens.js';
import {
  allowedOriginUrl,
  applyAppHardening,
  applySessionHardening,
  createMainWindow,
  isAllowedOrigin,
} from './window.js';

export interface BootstrapPaths {
  hostEntry: string;
  preload: string;
  html: string;
}

function coordinationBridgePath(hostEntry: string): string {
  const adjacent = join(dirname(hostEntry), 'threadhelm-coordination-bridge.exe');
  return adjacent.replace(`${join('app.asar', 'out')}`, `${join('app.asar.unpacked', 'out')}`);
}

function fileSink(path: string): LogSink {
  return {
    write: (line) =>
      appendFileSync(
        path,
        `${line}
`,
      ),
  };
}

export function bootstrap(paths: BootstrapPaths): void {
  // 1. one controlling instance per user, before anything else
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  let window: BrowserWindow | null = null;
  const getWindow = () => window;
  let quitting = false;

  app.on('second-instance', () => {
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  });

  applyAppHardening();

  void app.whenReady().then(() => {
    applySessionHardening();
    const userData = app.getPath('userData');
    mkdirSync(join(userData, 'logs'), { recursive: true });
    const log = createLogger(
      multiSink(stderrSink, fileSink(join(userData, 'logs', 'threadhelm.log'))),
    );
    log.info('app.starting', { version: app.getVersion(), arch: process.arch });

    const events = createRendererEvents(getWindow);
    const health = new StorageHealth(log);
    health.attach(events);

    // 2. storage in userData; corruption preserved and repaired, never hidden
    let storage: Storage | null = null;
    try {
      storage = openStorage(join(userData, 'threadhelm.sqlite'));
      if (storage.repaired) {
        log.warn('storage.repaired', { reason: storage.repaired.reason });
      }
      for (const adapter of builtInAdapters) {
        storage.repositories.definitions.upsertBuiltIn({
          id: adapter.id,
          displayName: adapter.displayName,
          providerKind: adapter.id,
          executableCandidates: adapter.executableCandidates.map(
            (c) => `${c.relativeTo}:${c.subpath}`,
          ),
          testedVersionRange: `${adapter.testedVersionRange.min} <${adapter.testedVersionRange.maxExclusive}`,
          capabilities: adapter.capabilities,
        });
      }
    } catch (error) {
      log.error('storage.unavailable', {
        code: error instanceof ThreadHelmError ? error.code : 'UNKNOWN',
      });
    }
    const degradedHealth = storage
      ? health
      : Object.assign(new StorageHealth(log, true, 'STORAGE_UNAVAILABLE'), {
          attach: health.attach,
        });

    const ctx: Context = {
      log,
      clock: () => new Date(),
      native,
      hosts: electronHostSpawner(paths.hostEntry),
      channels: electronChannels,
      picker: electronPicker(getWindow),
      profilePicker: electronProfileFilePicker(getWindow),
      agentExportPicker: electronAgentExportTargetPicker(getWindow),
      events,
      storage,
      health: degradedHealth,
      leases: new ControllerLeases(),
      jobs: new JobRegistry(native, log),
      live: new Map(),
      tokens: {
        candidates: new TokenStore(),
        previews: new TokenStore(),
        stops: new TokenStore(),
        forces: new TokenStore(),
      },
      selection: { selectedSessionId: null },
      adapters: builtInAdapters,
      probes: createProbeRunner(),
      structuredDraft: createStructuredDraftRunner(),
      // Recon output lives under userData, never inside an approved workspace.
      reconRoot: () => join(userData, 'recon'),
      appInfo: {
        version: app.getVersion(),
        electronVersion: process.versions.electron,
        arch: process.arch,
      },
      quit: () => {
        quitting = true;
        app.quit();
      },
    };
    if (storage) {
      ctx.coordinationBridge = new BridgeSessionManager({
        repo: storage.repositories.coordination,
        clock: ctx.clock,
        configRoot: join(userData, 'coordination-sessions'),
        bridgeExecutablePath: coordinationBridgePath(paths.hostEntry),
        adapters: ctx.adapters,
        onEvent: (payload) => events.emit('coordination.bridgeChanged', payload),
        onLifecycleEvidence: (evidence) => presentNextAtSafePoint(ctx, evidence),
        onHandoffChanged: (handoffId) => publishLatest(ctx, handoffId),
      });
    }

    // 3. honest state for every session left behind by the previous run
    if (storage) {
      try {
        reconcileAtStartup(ctx);
        reconcileCoordinationAtStartup(ctx);
      } catch (error) {
        log.error('recovery.reconcile_failed', {
          code: error instanceof ThreadHelmError ? error.code : 'UNKNOWN',
        });
      }
    }

    // 4. renderer boundary
    const router = createRouter(createHandlers(ctx), { isAllowedOrigin, log });
    bindRouter(router);
    if (testHooksEnabled()) installTestHooks(ctx, router, allowedOriginUrl);
    window = createMainWindow({ preload: paths.preload, html: paths.html });
    window.on('close', (event) => {
      if (quitting) return;
      const result = requestClose(ctx);
      if (!result.closing) event.preventDefault();
    });
    window.on('closed', () => {
      window = null;
    });
    if (storage?.repaired) {
      window.webContents.once('did-finish-load', () =>
        events.emit('application.storageHealth', {
          degraded: false,
          reasonCode: 'STORAGE_REPAIRED',
        }),
      );
    }
    if (!storage) {
      window.webContents.once('did-finish-load', () =>
        events.emit('application.storageHealth', {
          degraded: true,
          reasonCode: 'STORAGE_UNAVAILABLE',
        }),
      );
    }

    // 5. Windows power transitions
    attachPowerEvents(ctx, powerMonitor);

    app.on('before-quit', () => {
      cancelClose();
      quitting = true;
      stopCoordination(ctx);
      ctx.coordinationBridge?.revokeAll();
      // Closing every retained handle kills any surviving scope.
      ctx.jobs.closeAll();
      storage?.db.close();
      log.info('app.quit', { liveSessions: ctx.live.size });
    });
  });

  app.on('window-all-closed', () => app.quit());
}
