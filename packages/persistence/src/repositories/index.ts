/** Repository bundle + transaction wrapper (T020, invariant 5). */

import type { Db } from '../migrate.js';
import { AgentDefinitionRepository, AgentReadinessSnapshotRepository } from './providers.js';
import { RecoveryRecordRepository } from './recovery.js';
import { AgentSessionRepository, SessionEventRepository } from './sessions.js';
import { ApprovedWorkspaceRepository } from './workspaces.js';

export interface Repositories {
  workspaces: ApprovedWorkspaceRepository;
  definitions: AgentDefinitionRepository;
  readiness: AgentReadinessSnapshotRepository;
  sessions: AgentSessionRepository;
  events: SessionEventRepository;
  recovery: RecoveryRecordRepository;
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
    transaction: <T>(fn: () => T): T => db.transaction(fn)(),
  };
}

export * from './providers.js';
export * from './recovery.js';
export * from './sessions.js';
export * from './workspaces.js';
