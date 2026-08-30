/** Repository bundle + transaction wrapper (T020, invariant 5). */

import type { Db } from '../migrate.js';
import { AgentDefinitionRepository, AgentReadinessSnapshotRepository } from './providers.js';
import { RecoveryRecordRepository } from './recovery.js';
import { AgentSessionRepository, SessionEventRepository } from './sessions.js';
import { ApprovedWorkspaceRepository } from './workspaces.js';
import { CoordinationRepository } from './coordination.js';
import { SharedMemoryRepository } from './shared-memory.js';

export interface Repositories {
  workspaces: ApprovedWorkspaceRepository;
  definitions: AgentDefinitionRepository;
  readiness: AgentReadinessSnapshotRepository;
  sessions: AgentSessionRepository;
  events: SessionEventRepository;
  recovery: RecoveryRecordRepository;
  coordination: CoordinationRepository;
  memory: SharedMemoryRepository;
  /** Runs `fn` atomically; nested calls become savepoints. */
  transaction<T>(fn: () => T): T;
}

export function createRepositories(db: Db): Repositories {
  return {
    workspaces: new ApprovedWorkspaceRepository(db),
    definitions: new AgentDefinitionRepository(db),
    readiness: new AgentReadinessSnapshotRepository(db),
    sessions: new AgentSessionRepository(db),
    events: new SessionEventRepository(db),
    recovery: new RecoveryRecordRepository(db),
    coordination: new CoordinationRepository(db),
    memory: new SharedMemoryRepository(db),
    transaction: <T>(fn: () => T): T => db.transaction(fn)(),
  };
}

export * from './providers.js';
export * from './recovery.js';
export * from './sessions.js';
export * from './workspaces.js';
export * from './coordination.js';
export * from './shared-memory.js';
