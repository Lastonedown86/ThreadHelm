/**
 * Transactional agent-profile repository (T098). A profile id is stable and
 * independent of its mutable display name; revisions are immutable and
 * digest-pinned, and a manifest grants no authority beyond what is persisted
 * here.
 *
 * Contract: specs/002-agent-mailbox-routing/contracts/agent-profiles.md
 */

import { randomUUID } from 'node:crypto';
import {
  ThreadHelmError,
  type AgentProfileManifestSpec,
  type AgentProfileDetailView,
  type AgentProfileSummaryView,
  type ProfileCompatibility,
  type ProfileProviderId,
  type ProfileState,
} from '@threadhelm/contracts';
import { advanceProfileState } from '@threadhelm/domain';

import type { Db } from '../migrate.js';

interface ProfileRow {
  id: string;
  manifest_key: string;
  current_revision_id: string | null;
  state: ProfileState;
  created_at: string;
  updated_at: string;
}

interface RevisionRow {
  id: string;
  profile_id: string;
  digest: string;
  display_name: string;
  description: string;
  requested_provider: ProfileProviderId;
  requested_model: string;
  capabilities: string;
  isolate_requested: number;
  token_cap_requested: number;
  author: string;
  goal: string;
  manifest_spec: AgentProfileManifestSpec;
  compatibility: ProfileCompatibility;
  compatibility_reasons: string;
  source_basename: string;
  created_at: string;
}

export interface ImportProfileManifestInput {
  manifestKey: string;
  digest: string;
  displayName: string;
  description: string;
  requestedProvider: ProfileProviderId;
  requestedModel: string;
  capabilities: readonly string[];
  isolateRequested: boolean;
  tokenCapRequested: number;
  author: string;
  goal: string;
  manifestSpec: AgentProfileManifestSpec;
  compatibility: ProfileCompatibility;
  compatibilityReasons?: readonly string[];
  sourceBasename: string;
  createdAt: string;
}

export interface ImportedProfileResult {
  profileId: string;
  revisionId: string;
  isNewProfile: boolean;
  isNewRevision: boolean;
}

export interface ProfileDeletionPreview {
  profileId: string;
  displayName: string;
}

export interface ProfileListOptions {
  state?: ProfileState;
  compatibility?: ProfileCompatibility;
  cursor?: string;
  limit?: number;
}

export interface ProfileListPage {
  profiles: AgentProfileSummaryView[];
  nextCursor: string | null;
}

function encodeCursor(updatedAt: string, id: string): string {
  return Buffer.from(JSON.stringify([updatedAt, id]), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): [string, string] {
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
    if (
      !Array.isArray(value) ||
      value.length !== 2 ||
      typeof value[0] !== 'string' ||
      typeof value[1] !== 'string'
    ) {
      throw new Error('invalid');
    }
    return [value[0], value[1]];
  } catch {
    throw new ThreadHelmError('INVALID_REQUEST', 'The profile cursor is invalid.');
  }
}

function toSummary(profile: ProfileRow, revision: RevisionRow): AgentProfileSummaryView {
  return {
    profileId: profile.id,
    currentRevisionId: revision.id,
    displayName: revision.display_name,
    description: revision.description,
    requestedProvider: revision.requested_provider,
    requestedModel: revision.requested_model,
    compatibility: revision.compatibility,
    state: profile.state,
    capabilities: JSON.parse(revision.capabilities) as string[],
    isolateRequested: Boolean(revision.isolate_requested),
    tokenCapRequested: revision.token_cap_requested,
    author: revision.author,
    digestPrefix: revision.digest.slice(0, 12),
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  } as AgentProfileSummaryView;
}

function toDetail(
  profile: ProfileRow,
  revision: RevisionRow,
  history: readonly RevisionRow[],
): AgentProfileDetailView {
  return {
    ...toSummary(profile, revision),
    goal: revision.goal,
    digest: revision.digest,
    manifestSpec: revision.manifest_spec,
    compatibilityReasons: JSON.parse(revision.compatibility_reasons) as string[],
    revisionHistory: history.map((row) => ({
      revisionId: row.id,
      digest: row.digest,
      createdAt: row.created_at,
    })),
  } as AgentProfileDetailView;
}

export class AgentProfileRepository {
  readonly #db: Db;

  constructor(db: Db) {
    this.#db = db;
  }

  #profile(id: string): ProfileRow | null {
    return (
      (this.#db.prepare('SELECT * FROM agent_profiles WHERE id = ?').get(id) as
        ProfileRow | undefined) ?? null
    );
  }

  #profileByManifestKey(manifestKey: string): ProfileRow | null {
    return (
      (this.#db.prepare('SELECT * FROM agent_profiles WHERE manifest_key = ?').get(manifestKey) as
        ProfileRow | undefined) ?? null
    );
  }

  #revision(id: string): RevisionRow | null {
    return (
      (this.#db.prepare('SELECT * FROM agent_profile_revisions WHERE id = ?').get(id) as
        RevisionRow | undefined) ?? null
    );
  }

  #revisionByDigest(profileId: string, digest: string): RevisionRow | null {
    return (
      (this.#db
        .prepare('SELECT * FROM agent_profile_revisions WHERE profile_id = ? AND digest = ?')
        .get(profileId, digest) as RevisionRow | undefined) ?? null
    );
  }

  #history(profileId: string): RevisionRow[] {
    return this.#db
      .prepare('SELECT * FROM agent_profile_revisions WHERE profile_id = ? ORDER BY created_at, id')
      .all(profileId) as RevisionRow[];
  }

  #assertNotMissionPinned(profileId: string): void {
    const pinned = this.#db
      .prepare('SELECT 1 FROM mission_profile_pins WHERE profile_id = ? LIMIT 1')
      .get(profileId);
    if (pinned) {
      throw new ThreadHelmError(
        'PROFILE_MISSION_PINNED',
        'The profile is pinned by an active mission.',
      );
    }
  }

  #insertRevision(profileId: string, input: ImportProfileManifestInput): string {
    const revisionId = randomUUID();
    this.#db
      .prepare(
        `INSERT INTO agent_profile_revisions
          (id, profile_id, digest, display_name, description, requested_provider, requested_model,
           capabilities, isolate_requested, token_cap_requested, author, goal, manifest_spec,
           compatibility, compatibility_reasons, source_basename, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        revisionId,
        profileId,
        input.digest,
        input.displayName,
        input.description,
        input.requestedProvider,
        input.requestedModel,
        JSON.stringify(input.capabilities),
        Number(input.isolateRequested),
        input.tokenCapRequested,
        input.author,
        input.goal,
        input.manifestSpec,
        input.compatibility,
        JSON.stringify(input.compatibilityReasons ?? []),
        input.sourceBasename,
        input.createdAt,
      );
    return revisionId;
  }

  importManifest(input: ImportProfileManifestInput): ImportedProfileResult {
    return this.#db.transaction((): ImportedProfileResult => {
      const existingProfile = this.#profileByManifestKey(input.manifestKey);

      if (!existingProfile) {
        const profileId = randomUUID();
        const initialState: ProfileState =
          input.compatibility === 'compatible' ? 'active' : 'disabled';
        this.#db
          .prepare(
            `INSERT INTO agent_profiles (id, manifest_key, current_revision_id, state, created_at, updated_at)
             VALUES (?, ?, NULL, ?, ?, ?)`,
          )
          .run(profileId, input.manifestKey, initialState, input.createdAt, input.createdAt);
        const revisionId = this.#insertRevision(profileId, input);
        this.#db
          .prepare('UPDATE agent_profiles SET current_revision_id = ? WHERE id = ?')
          .run(revisionId, profileId);
        return { profileId, revisionId, isNewProfile: true, isNewRevision: true };
      }

      if (existingProfile.state === 'deleted') {
        throw new ThreadHelmError(
          'PROFILE_NOT_FOUND',
          'The deleted agent profile cannot be revised.',
        );
      }

      const existingRevision = this.#revisionByDigest(existingProfile.id, input.digest);
      if (existingRevision) {
        const compatibilityReasons = JSON.stringify(input.compatibilityReasons ?? []);
        const compatibilityChanged =
          existingRevision.compatibility !== input.compatibility ||
          existingRevision.compatibility_reasons !== compatibilityReasons;
        if (existingProfile.current_revision_id === existingRevision.id && compatibilityChanged) {
          // Manifest fields and digest remain immutable. Compatibility is
          // derived from current runtime availability and must be refreshed.
          const nextState: ProfileState =
            input.compatibility === 'compatible' ? existingProfile.state : 'disabled';
          this.#db
            .prepare(
              `UPDATE agent_profile_revisions
               SET compatibility = ?, compatibility_reasons = ?
               WHERE id = ?`,
            )
            .run(input.compatibility, compatibilityReasons, existingRevision.id);
          this.#db
            .prepare('UPDATE agent_profiles SET state = ?, updated_at = ? WHERE id = ?')
            .run(nextState, input.createdAt, existingProfile.id);
        }
        return {
          profileId: existingProfile.id,
          revisionId: existingRevision.id,
          isNewProfile: false,
          isNewRevision: false,
        };
      }

      const revisionId = this.#insertRevision(existingProfile.id, input);
      const nextState: ProfileState =
        input.compatibility === 'compatible' ? existingProfile.state : 'disabled';
      this.#db
        .prepare(
          'UPDATE agent_profiles SET current_revision_id = ?, state = ?, updated_at = ? WHERE id = ?',
        )
        .run(revisionId, nextState, input.createdAt, existingProfile.id);
      return {
        profileId: existingProfile.id,
        revisionId,
        isNewProfile: false,
        isNewRevision: true,
      };
    })();
  }

  getSummary(profileId: string): AgentProfileSummaryView | undefined {
    const profile = this.#profile(profileId);
    if (!profile || !profile.current_revision_id) return undefined;
    const revision = this.#revision(profile.current_revision_id);
    if (!revision) return undefined;
    return toSummary(profile, revision);
  }

  getDetail(profileId: string): AgentProfileDetailView | undefined {
    const profile = this.#profile(profileId);
    if (!profile || !profile.current_revision_id) return undefined;
    const revision = this.#revision(profile.current_revision_id);
    if (!revision) return undefined;
    return toDetail(profile, revision, this.#history(profileId));
  }

  getDetailByRevision(revisionId: string): AgentProfileDetailView | undefined {
    const revision = this.#revision(revisionId);
    const profile = revision ? this.#profile(revision.profile_id) : null;
    return revision && profile ? toDetail(profile, revision, this.#history(profile.id)) : undefined;
  }

  list(options: ProfileListOptions = {}): ProfileListPage {
    const limit = Math.max(1, Math.min(options.limit ?? 50, 100));
    const where = ["p.state <> 'deleted'"];
    const params: unknown[] = [];
    if (options.state) {
      where.push('p.state = ?');
      params.push(options.state);
    }
    if (options.compatibility) {
      where.push('r.compatibility = ?');
      params.push(options.compatibility);
    }
    if (options.cursor) {
      const [updatedAt, id] = decodeCursor(options.cursor);
      where.push('(p.updated_at < ? OR (p.updated_at = ? AND p.id < ?))');
      params.push(updatedAt, updatedAt, id);
    }
    const rows = this.#db
      .prepare(
        `SELECT p.*, r.id AS r_id, r.profile_id AS r_profile_id, r.digest AS r_digest,
                r.display_name AS r_display_name, r.description AS r_description,
                r.requested_provider AS r_requested_provider, r.requested_model AS r_requested_model,
                r.capabilities AS r_capabilities, r.isolate_requested AS r_isolate_requested,
                r.token_cap_requested AS r_token_cap_requested, r.author AS r_author,
                r.goal AS r_goal, r.manifest_spec AS r_manifest_spec,
                r.compatibility AS r_compatibility,
                r.compatibility_reasons AS r_compatibility_reasons,
                r.source_basename AS r_source_basename, r.created_at AS r_created_at
           FROM agent_profiles p
           JOIN agent_profile_revisions r ON r.id = p.current_revision_id
          WHERE ${where.join(' AND ')}
          ORDER BY p.updated_at DESC, p.id DESC
          LIMIT ?`,
      )
      .all(...params, limit + 1) as (ProfileRow & Record<string, unknown>)[];
    const pageRows = rows.slice(0, limit);
    const profiles = pageRows.map((row) =>
      toSummary(row, {
        id: row.r_id as string,
        profile_id: row.r_profile_id as string,
        digest: row.r_digest as string,
        display_name: row.r_display_name as string,
        description: row.r_description as string,
        requested_provider: row.r_requested_provider as ProfileProviderId,
        requested_model: row.r_requested_model as string,
        capabilities: row.r_capabilities as string,
        isolate_requested: row.r_isolate_requested as number,
        token_cap_requested: row.r_token_cap_requested as number,
        author: row.r_author as string,
        goal: row.r_goal as string,
        manifest_spec: row.r_manifest_spec as AgentProfileManifestSpec,
        compatibility: row.r_compatibility as ProfileCompatibility,
        compatibility_reasons: row.r_compatibility_reasons as string,
        source_basename: row.r_source_basename as string,
        created_at: row.r_created_at as string,
      }),
    );
    const last = pageRows.at(-1);
    return {
      profiles,
      nextCursor: rows.length > limit && last ? encodeCursor(last.updated_at, last.id) : null,
    };
  }

  setEnabled(
    profileId: string,
    revisionId: string,
    enabled: boolean,
    at: string,
  ): AgentProfileSummaryView {
    const profile = this.#profile(profileId);
    if (!profile || profile.state === 'deleted') {
      throw new ThreadHelmError('PROFILE_NOT_FOUND', 'The agent profile was not found.');
    }
    if (profile.current_revision_id !== revisionId) {
      throw new ThreadHelmError(
        'PROFILE_REVISION_STALE',
        'The profile revision has changed since it was reviewed.',
      );
    }
    const revision = this.#revision(revisionId)!;
    if (enabled && revision.compatibility !== 'compatible') {
      throw new ThreadHelmError(
        'PROFILE_INCOMPATIBLE',
        'An incompatible profile revision cannot be enabled.',
      );
    }
    const nextState = advanceProfileState(profile.state, enabled ? 'active' : 'disabled');
    this.#db
      .prepare('UPDATE agent_profiles SET state = ?, updated_at = ? WHERE id = ?')
      .run(nextState, at, profileId);
    return this.getSummary(profileId)!;
  }

  previewDelete(profileId: string): ProfileDeletionPreview {
    const profile = this.#profile(profileId);
    if (!profile || profile.state === 'deleted') {
      throw new ThreadHelmError('PROFILE_NOT_FOUND', 'The agent profile was not found.');
    }
    this.#assertNotMissionPinned(profileId);
    if (profile.state !== 'disabled') {
      throw new ThreadHelmError('INVALID_STATE', 'Disable the agent profile before deleting it.');
    }
    const revision = this.#revision(profile.current_revision_id!)!;
    return { profileId: profile.id, displayName: revision.display_name };
  }

  confirmDelete(profileId: string, at: string): { profileId: string; state: 'deleted' } {
    const profile = this.#profile(profileId);
    if (!profile || profile.state === 'deleted') {
      throw new ThreadHelmError('PROFILE_NOT_FOUND', 'The agent profile was not found.');
    }
    this.#assertNotMissionPinned(profileId);
    if (profile.state !== 'disabled') {
      throw new ThreadHelmError('INVALID_STATE', 'Disable the agent profile before deleting it.');
    }
    advanceProfileState(profile.state, 'deleted');
    this.#db
      .prepare("UPDATE agent_profiles SET state = 'deleted', updated_at = ? WHERE id = ?")
      .run(at, profileId);
    return { profileId, state: 'deleted' };
  }
}
