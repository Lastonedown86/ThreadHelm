/** Repository bundle + transaction wrapper (T020, invariant 5). */

import type { Db } from '../migrate.js';
import { AgentDefinitionRepository, AgentReadinessSnapshotRepository } from './providers.js';
import { RecoveryRecordRepository } from './recovery.js';
import { AgentSessionRepository, SessionEventRepository } from './sessions.js';
import { ApprovedWorkspaceRepository } from './workspaces.js';
import { CoordinationRepository } from './coordination.js';
import { SharedMemoryRepository } from './shared-memory.js';
import { AgentProfileRepository } from './agent-profiles.js';
import { AgentTemplateRepository } from './agent-templates.js';
import { AgentProfileExportRepository } from './agent-profile-exports.js';
import { SupervisorRepository } from './supervisor.js';
import { MissionComposerRepository } from './mission-composer.js';

export interface Repositories {
  workspaces: ApprovedWorkspaceRepository;
  definitions: AgentDefinitionRepository;
  readiness: AgentReadinessSnapshotRepository;
  sessions: AgentSessionRepository;
  events: SessionEventRepository;
  recovery: RecoveryRecordRepository;
  coordination: CoordinationRepository;
  memory: SharedMemoryRepository;
  agentProfiles: AgentProfileRepository;
  agentTemplates: AgentTemplateRepository;
  agentProfileExports: AgentProfileExportRepository;
  supervisor: SupervisorRepository;
  missionComposer: MissionComposerRepository;
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
    agentProfiles: new AgentProfileRepository(db),
    agentTemplates: new AgentTemplateRepository(db),
    agentProfileExports: new AgentProfileExportRepository(db),
    supervisor: new SupervisorRepository(db),
    missionComposer: new MissionComposerRepository(db),
    transaction: <T>(fn: () => T): T => db.transaction(fn)(),
  };
}

export * from './providers.js';
export * from './recovery.js';
export * from './sessions.js';
export * from './workspaces.js';
export * from './coordination.js';
export * from './shared-memory.js';
export * from './agent-profiles.js';
export * from './agent-templates.js';
export * from './agent-profile-exports.js';
export * from './supervisor.js';
export * from './mission-composer.js';
