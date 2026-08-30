/**
 * Coordinator context: every dependency the main-process services need,
 * expressed as narrow interfaces so contract tests can substitute fakes for
 * Electron, the native module, the picker, and the host processes.
 */

import type { MessagePortMain } from 'electron';
import type {
  LifecycleState,
  LaunchPermissionResolution,
  LaunchRuntimeResolution,
  LaunchPermissionSelection,
  LaunchRuntimeSelection,
  MainToHostMessage,
  ProviderId,
  ReadinessView,
  TerminalSize,
  ProviderExecutionBounds,
  WorkspaceIdentity,
} from '@threadhelm/contracts';
import type { ControllerLeases } from '@threadhelm/domain';
import type { Storage } from '@threadhelm/persistence';
import type { ProbeContext, ProviderAdapter } from '@threadhelm/providers';
import type { RendererEvents } from './ipc/electron-binding.js';
import type { Logger } from './logging.js';
import type { TokenStore } from './tokens.js';
import type { JobRegistry } from './native/job-registry.js';
import type { StorageHealth } from './storage-health.js';
import type { CoordinationService } from './coordination/service.js';
import type { BridgeSessionManager } from './coordination/bridge.js';
import type { MemoryService } from './coordination/memory.js';
import type { ProfileService } from './coordination/profiles.js';

// --- native boundary (contracts/windows-supervisor.md) ----------------------

export interface DirectoryIdentity {
  selectedPath: string;
  canonicalPath: string;
  displayPath: string;
  volumeSerial: string;
  fileId: string;
  driveType: string;
  isReparsePoint: boolean;
}

export interface JobSnapshot {
  activeProcessCount: number;
  processIds: number[];
  truncated: boolean;
}

export interface NativeSupervisor {
  resolveDirectory(selectedPath: string): DirectoryIdentity;
  createKillOnCloseJob(): number;
  assignProcess(token: number, pid: number): void;
  verifyProcessInJob(token: number, pid: number): boolean;
  inspectJob(token: number): JobSnapshot;
  terminateJob(token: number, exitCode: number): JobSnapshot;
  closeJob(token: number): void;
}

// --- process topology ---------------------------------------------------------

export interface HostHandle {
  readonly pid: number | undefined;
  postMessage(message: MainToHostMessage, ports?: MessagePortMain[]): void;
  onMessage(listener: (message: unknown) => void): void;
  onExit(listener: (code: number) => void): void;
  kill(): void;
}

export interface HostSpawner {
  spawn(sessionId: string): HostHandle;
}

export interface StreamChannel {
  hostPort: MessagePortMain;
  rendererPort: MessagePortMain;
}

export interface StreamChannelFactory {
  create(): StreamChannel;
}

export interface DirectoryPicker {
  pickDirectory(): Promise<string | null>;
}

export interface ProfileFilePicker {
  pickFile(): Promise<string | null>;
}

// --- provider probing ---------------------------------------------------------

export interface ProbeRunner {
  /** Builds a ProbeContext whose search roots exclude `excludedDirectories`. */
  context(excludedDirectories: readonly string[]): ProbeContext;
}

// --- live session state (volatile; never sufficient for reattachment) ---------

export interface LiveSession {
  id: string;
  workspaceId: string;
  identity: WorkspaceIdentity;
  canonicalPath: string;
  providerId: ProviderId;
  adapter: ProviderAdapter;
  readiness: ReadinessView;
  host: HostHandle;
  jobToken: number;
  hostPid: number;
  rootPid: number | null;
  terminal: TerminalSize;
  /** Mirror of the durable lifecycle state, kept for hot-path checks. */
  state: LifecycleState;
  forceStopAvailable: boolean;
  controlSequence: number;
  /** Waiters resolved `true` only by matching `host.controlApplied`; teardown resolves `false`. */
  pendingControls: Map<number, (applied: boolean) => void>;
  rendererPort: MessagePortMain | null;
  exit: { exitCode: number | null } | null;
  /** Set while an interrupt is being observed. */
  interrupt: { controlSequence: number; applied: boolean } | null;
  /** Set while a clean stop is in progress. */
  stop: { controlSequence: number; timedOut: boolean } | null;
}

export interface Selection {
  selectedSessionId: string | null;
}

export interface TokenStores {
  candidates: TokenStore<CandidatePayload>;
  previews: TokenStore<PreviewPayload>;
  stops: TokenStore<ControlTokenPayload>;
  forces: TokenStore<ControlTokenPayload>;
}

export interface CandidatePayload {
  selectedPath: string;
  canonicalPath: string;
  displayPath: string;
  identity: WorkspaceIdentity;
  isReparsePoint: boolean;
}

export interface PreviewPayload {
  workspaceId: string;
  identity: WorkspaceIdentity;
  canonicalPath: string;
  providerId: ProviderId;
  readiness: ReadinessView;
  terminal: TerminalSize;
  runtimeSelection: LaunchRuntimeSelection;
  runtimeResolution: LaunchRuntimeResolution;
  permissionSelection: LaunchPermissionSelection;
  permissionResolution: LaunchPermissionResolution;
  executionBounds: ProviderExecutionBounds;
}

export interface ControlTokenPayload {
  sessionId: string;
  /** Lifecycle state shown to the user when the disclosure was issued. */
  lifecycleState: LifecycleState;
}

export interface AppInfo {
  version: string;
  electronVersion: string;
  arch: string;
}

export interface Context {
  log: Logger;
  clock: () => Date;
  native: NativeSupervisor;
  hosts: HostSpawner;
  channels: StreamChannelFactory;
  picker: DirectoryPicker;
  profilePicker: ProfileFilePicker;
  events: RendererEvents;
  storage: Storage | null;
  health: StorageHealth;
  leases: ControllerLeases;
  jobs: JobRegistry;
  live: Map<string, LiveSession>;
  tokens: TokenStores;
  selection: Selection;
  adapters: readonly ProviderAdapter[];
  probes: ProbeRunner;
  /** Main-owned coordination seam; absent until coordination startup is composed. */
  coordination?: CoordinationService;
  /** Main-owned shared-memory authority; absent until handler composition. */
  memory?: MemoryService;
  /** Main-owned reviewed-profile import and roster authority. */
  profiles?: ProfileService;
  /** Session-scoped provider bridge authority; absent in degraded/test compositions. */
  coordinationBridge?: BridgeSessionManager;
  appInfo: AppInfo;
  /** Quit the application once every session is stopped. */
  quit: () => void;
}

export function now(ctx: Context): string {
  return ctx.clock().toISOString();
}
