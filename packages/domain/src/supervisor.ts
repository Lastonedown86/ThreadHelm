/** Pure supervisor authority, graph, retry, lease and deterministic-bound policy. */
import { ThreadHelmError } from '@threadhelm/contracts';

export interface WorkGraphNode {
  id: string;
  workspaceId: string;
  parentWorkItemId: string | null;
  dependencies: readonly string[];
  state: string;
  authorityClass?: string;
}

/** A child can narrow routine work but cannot launder a held ancestor's authority. */
export function assertRoutineWorkAuthority(
  nodes: readonly WorkGraphNode[],
  workItemId: string,
): void {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const seen = new Set<string>();
  let current = byId.get(workItemId);
  while (current) {
    if (seen.has(current.id)) throw new ThreadHelmError('WORK_DAG_INVALID');
    seen.add(current.id);
    if (
      (current.authorityClass && current.authorityClass !== 'routine') ||
      (current.id !== workItemId &&
        ['escalated', 'cancelled', 'failed', 'waiting'].includes(current.state))
    )
      throw new ThreadHelmError('MISSION_AUTHORITY_REQUIRED');
    if (!current.parentWorkItemId) return;
    current = byId.get(current.parentWorkItemId);
  }
  throw new ThreadHelmError('WORK_DAG_INVALID');
}

export function assertWorkGraph(
  existing: readonly WorkGraphNode[],
  proposed: readonly WorkGraphNode[],
  bounds: { maxWorkItems: number; maxDepth: number },
  approvedWorkspaces: readonly string[],
): void {
  const nodes = [...existing, ...proposed];
  if (nodes.length > Math.min(64, bounds.maxWorkItems))
    throw new ThreadHelmError('MISSION_BOUND_REACHED');
  const map = new Map(nodes.map((node) => [node.id, node]));
  if (map.size !== nodes.length) throw new ThreadHelmError('WORK_DAG_INVALID');
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const visit = (id: string): number => {
    if (visiting.has(id)) throw new ThreadHelmError('WORK_DAG_INVALID');
    const known = depth.get(id);
    if (known !== undefined) return known;
    const node = map.get(id);
    if (!node) throw new ThreadHelmError('WORK_DAG_INVALID');
    if (!approvedWorkspaces.includes(node.workspaceId))
      throw new ThreadHelmError('MISSION_AUTHORITY_REQUIRED');
    if (new Set(node.dependencies).size !== node.dependencies.length)
      throw new ThreadHelmError('WORK_DAG_INVALID');
    visiting.add(id);
    const links = [...node.dependencies, ...(node.parentWorkItemId ? [node.parentWorkItemId] : [])];
    const value = 1 + Math.max(0, ...links.map(visit));
    if (value > Math.min(8, bounds.maxDepth)) throw new ThreadHelmError('MISSION_BOUND_REACHED');
    visiting.delete(id);
    depth.set(id, value);
    return value;
  };
  for (const node of nodes) visit(node.id);
}

export function authorizeSupervisor(
  binding: { missionId: string; sessionId: string | null; role: string; state: string },
  missionId: string,
  sessionId: string,
): void {
  if (binding.role !== 'supervisor') throw new ThreadHelmError('SUPERVISOR_ROLE_REQUIRED');
  if (
    binding.missionId !== missionId ||
    binding.sessionId !== sessionId ||
    binding.state !== 'running'
  ) {
    throw new ThreadHelmError('SUPERVISOR_NOT_BOUND');
  }
}

export function assertSafeRetry(
  attempts: number,
  previous: { state: string; effect: string; retryClass: string | null },
  maxAttempts: number,
  safeClasses: readonly string[],
): void {
  if (previous.state === 'unknown' || previous.effect !== 'none')
    throw new ThreadHelmError('WORK_ATTEMPT_UNKNOWN');
  if (attempts >= Math.min(3, maxAttempts)) throw new ThreadHelmError('MISSION_BOUND_REACHED');
  if (
    previous.state !== 'failed' ||
    !previous.retryClass ||
    !safeClasses.includes(previous.retryClass)
  ) {
    throw new ThreadHelmError('MISSION_AUTHORITY_REQUIRED');
  }
}

/** Content-derived only in durable local state; never a log/event field. */
export function normalizeSupervisorDecision(kind: string, payload: unknown): string {
  const localIds = new Map<string, string>();
  if (
    kind === 'decompose' &&
    payload &&
    typeof payload === 'object' &&
    'items' in payload &&
    Array.isArray(payload.items)
  ) {
    for (const item of payload.items as Record<string, unknown>[]) {
      if (typeof item.id === 'string')
        localIds.set(
          item.id,
          JSON.stringify(
            Object.entries(item)
              .filter(([key]) => !['id', 'dependencies', 'parentWorkItemId'].includes(key))
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, value]) => [
                key,
                typeof value === 'string'
                  ? value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase()
                  : value,
              ]),
          ),
        );
    }
  }
  const normalize = (value: unknown, key = ''): unknown => {
    if (typeof value === 'string')
      return (
        (key === 'dependencies' || key === 'parentWorkItemId' ? localIds.get(value) : null) ??
        value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase()
      );
    if (Array.isArray(value)) {
      const children = value.map((child) => normalize(child, key));
      return key === 'items' || key === 'dependencies'
        ? children.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
        : children;
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(
            ([name]) =>
              !['id', 'rationale', 'idempotencyKey', 'inputRefs', 'expectedEvidence'].includes(
                name,
              ),
          )
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([name, child]) => [name, normalize(child, name)]),
      );
    }
    return value;
  };
  return JSON.stringify([kind, normalize(payload)]);
}

/** Candidate plus the seven newest decisions is the eight-decision window. */
export function hasDecisionLoop(candidate: string, previous: readonly string[]): boolean {
  return previous.slice(-7).filter((fingerprint) => fingerprint === candidate).length >= 2;
}

export interface SupervisorUsage {
  startedAt: number;
  lastProgressAt: number;
  turnCount: number;
  outputBytes: number;
  activeProcessCount: number;
  tokensUsed: number;
  activeWorkers: number;
}
export interface SupervisorBounds {
  maxElapsedMs: number;
  maxTurns: number;
  maxNoProgressMs: number;
  maxOutputBytes: number;
  maxConcurrentProcesses: number;
  maxTokenBudget: number;
  maxWorkers: number;
}
export function assessMissionBounds(
  bounds: SupervisorBounds,
  usage: SupervisorUsage,
  now: number,
): 'elapsed_bound' | 'turn_bound' | 'no_progress' | 'resource_bound' | 'budget_exhausted' | null {
  if (now - usage.startedAt >= bounds.maxElapsedMs) return 'elapsed_bound';
  if (usage.turnCount >= bounds.maxTurns) return 'turn_bound';
  if (
    usage.outputBytes >= bounds.maxOutputBytes ||
    usage.activeProcessCount > bounds.maxConcurrentProcesses ||
    usage.activeWorkers > bounds.maxWorkers
  )
    return 'resource_bound';
  if (usage.tokensUsed >= bounds.maxTokenBudget) return 'budget_exhausted';
  if (now - usage.lastProgressAt >= bounds.maxNoProgressMs) return 'no_progress';
  return null;
}

export interface WorkerLeaseScope {
  volumeSerial: string;
  fileId: string;
  mode: string;
  state: string;
  workspaceId?: string;
}
export function workerLeaseConflicts(a: WorkerLeaseScope, b: WorkerLeaseScope): boolean {
  const live = new Set(['reserved', 'active', 'unknown']);
  return (
    live.has(a.state) &&
    live.has(b.state) &&
    a.volumeSerial.toLowerCase() === b.volumeSerial.toLowerCase() &&
    a.fileId.toLowerCase() === b.fileId.toLowerCase() &&
    (a.state === 'unknown' || b.state === 'unknown' || a.mode === 'write' || b.mode === 'write')
  );
}

const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`)
      .join(',')}}`;
  return JSON.stringify(value);
};
export function assertExactWorkerBinding(expected: unknown, current: unknown, now: number): void {
  if (stable(expected) !== stable(current))
    throw new ThreadHelmError('WORKER_AUTOSTART_PREFLIGHT_FAILED');
  const binding = current as {
    autoStart?: boolean;
    permissionResolution?: {
      policy: string;
      disposition: string;
      capabilityEvidence?: { expiresAt: string; organizationPolicy: string } | null;
    };
  };
  const permission = binding.permissionResolution;
  if (!binding.autoStart) throw new ThreadHelmError('WORKER_AUTOSTART_NOT_AUTHORIZED');
  if (
    !permission ||
    permission.policy === 'break_glass_bypass' ||
    permission.disposition !== 'ready'
  )
    throw new ThreadHelmError('WORKER_AUTOSTART_PREFLIGHT_FAILED');
  if (
    permission.policy === 'auto' &&
    (!permission.capabilityEvidence ||
      permission.capabilityEvidence.organizationPolicy !== 'allowed' ||
      !Number.isFinite(Date.parse(permission.capabilityEvidence.expiresAt)) ||
      Date.parse(permission.capabilityEvidence.expiresAt) <= now)
  ) {
    throw new ThreadHelmError('WORKER_AUTOSTART_PREFLIGHT_FAILED');
  }
}
