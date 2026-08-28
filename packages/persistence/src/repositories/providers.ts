/** AgentDefinition + AgentReadinessSnapshot repositories (T036). */

import { randomUUID } from 'node:crypto';
import type { Authentication, Availability, ProviderId } from '@threadhelm/contracts';

import type { Db } from '../migrate.js';
import { assertNoRawContent, sanitizeSummary } from '../sanitize.js';

export interface AgentDefinitionRecord {
  id: ProviderId;
  displayName: string;
  providerKind: string;
  executableCandidates: readonly string[];
  testedVersionRange: string;
  capabilities: {
    interactivePty: boolean;
    cleanStopStrategy: string;
    structuredActivity: boolean;
  };
}

interface DefinitionRow {
  id: ProviderId;
  display_name: string;
  provider_kind: string;
  executable_candidates: string;
  tested_version_range: string;
  capabilities: string;
}

const toDefinition = (r: DefinitionRow): AgentDefinitionRecord => ({
  id: r.id,
  displayName: r.display_name,
  providerKind: r.provider_kind,
  executableCandidates: JSON.parse(r.executable_candidates) as string[],
  testedVersionRange: r.tested_version_range,
  capabilities: JSON.parse(r.capabilities) as AgentDefinitionRecord['capabilities'],
});

export class AgentDefinitionRepository {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  upsertBuiltIn(definition: AgentDefinitionRecord): void {
    assertNoRawContent({
      displayName: definition.displayName,
      providerKind: definition.providerKind,
      testedVersionRange: definition.testedVersionRange,
      ...Object.fromEntries(definition.executableCandidates.map((c, i) => [`candidate${i}`, c])),
    });
    this.#db
      .prepare(
        `INSERT INTO agent_definitions
           (id, display_name, provider_kind, executable_candidates, tested_version_range, capabilities)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           display_name = excluded.display_name,
           provider_kind = excluded.provider_kind,
           executable_candidates = excluded.executable_candidates,
           tested_version_range = excluded.tested_version_range,
           capabilities = excluded.capabilities`,
      )
      .run(
        definition.id,
        definition.displayName,
        definition.providerKind,
        JSON.stringify(definition.executableCandidates),
        definition.testedVersionRange,
        JSON.stringify(definition.capabilities),
      );
  }

  list(): AgentDefinitionRecord[] {
    return (
      this.#db.prepare('SELECT * FROM agent_definitions ORDER BY id').all() as DefinitionRow[]
    ).map(toDefinition);
  }

  findById(id: ProviderId): AgentDefinitionRecord | null {
    const row = this.#db.prepare('SELECT * FROM agent_definitions WHERE id = ?').get(id) as
      DefinitionRow | undefined;
    return row ? toDefinition(row) : null;
  }
}

/** No raw probe output field exists here, by design. */
export interface ReadinessSnapshotInsert {
  providerId: ProviderId;
  resolvedExecutable: string | null;
  version: string | null;
  availability: Availability;
  authentication: Authentication;
  probedAt: string;
  reasonCode: string | null;
  safeSummary: string;
}

export interface ReadinessSnapshotRecord extends ReadinessSnapshotInsert {
  id: string;
}

interface SnapshotRow {
  id: string;
  provider_id: ProviderId;
  resolved_executable: string | null;
  version: string | null;
  availability: Availability;
  authentication: Authentication;
  probed_at: string;
  reason_code: string | null;
  safe_summary: string;
}

const toSnapshot = (r: SnapshotRow): ReadinessSnapshotRecord => ({
  id: r.id,
  providerId: r.provider_id,
  resolvedExecutable: r.resolved_executable,
  version: r.version,
  availability: r.availability,
  authentication: r.authentication,
  probedAt: r.probed_at,
  reasonCode: r.reason_code,
  safeSummary: r.safe_summary,
});

export class AgentReadinessSnapshotRepository {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  insert(snapshot: ReadinessSnapshotInsert): ReadinessSnapshotRecord {
    assertNoRawContent(snapshot);
    const id = randomUUID();
    this.#db
      .prepare(
        `INSERT INTO agent_readiness_snapshots
           (id, provider_id, resolved_executable, version, availability, authentication,
            probed_at, reason_code, safe_summary)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        snapshot.providerId,
        snapshot.resolvedExecutable,
        snapshot.version,
        snapshot.availability,
        snapshot.authentication,
        snapshot.probedAt,
        snapshot.reasonCode,
        sanitizeSummary(snapshot.safeSummary),
      );
    return this.findById(id)!;
  }

  findById(id: string): ReadinessSnapshotRecord | null {
    const row = this.#db.prepare('SELECT * FROM agent_readiness_snapshots WHERE id = ?').get(id) as
      SnapshotRow | undefined;
    return row ? toSnapshot(row) : null;
  }
}
