/** Main-owned reviewed-profile import, roster, and disclosure authority (US6). */

import { createHash, randomUUID } from 'node:crypto';
import { open } from 'node:fs/promises';
import { basename } from 'node:path';
import {
  AgentProfileDetailView,
  AgentProfileSummaryView,
  ProfileDeletionDisclosureView,
  ProfileEventEnvelope,
  ProfilePreviewView,
  ThreadHelmError,
  TOKEN_TTL_MS,
  type AgentManifestV1,
  type OperationRequest,
  type OperationResponse,
  type ProfileCompatibility,
  type ProfileEventKind,
  type ProviderId,
} from '@threadhelm/contracts';
import {
  evaluateProfileCompatibility,
  MAX_MANIFEST_BYTES,
  parseAgentManifest,
} from '@threadhelm/domain';
import type { ImportProfileManifestInput } from '@threadhelm/persistence';
import type { Context } from '../context.js';
import { TokenStore } from '../tokens.js';

const TESTED_MODELS: Readonly<Record<ProviderId, readonly string[]>> = {
  'claude-code': ['claude-opus-5', 'claude-sonnet-5'],
  'codex-cli': ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna'],
};

/**
 * One compatibility evaluation for every reviewed manifest, whichever path it
 * arrived on: file picker, wizard completion, or a recon proposal.
 */
export function evaluateManifestCompatibility(
  ctx: Context,
  manifest: AgentManifestV1,
): ReturnType<typeof evaluateProfileCompatibility> {
  return evaluateProfileCompatibility({
    requestedProvider: manifest.provider,
    requestedModel: manifest.model,
    availableProviderModels: Object.fromEntries(
      ctx.adapters.map((adapter) => [adapter.id, TESTED_MODELS[adapter.id]]),
    ),
  });
}

/** Where an accepted profile came from, when it came from a recon run. */
export interface ReconProvenance {
  readonly reconRunId: string;
  readonly derivedFromCommit: string | null;
}

/** What acceptance adds to a reviewed manifest. Both are absent for the wizard. */
export interface ReviewedManifestOptions {
  readonly provenance?: ReconProvenance;
  /**
   * The name the owner typed at acceptance. Absent keeps the manifest's own
   * name, which is what every path that authored the name itself relies on.
   */
  readonly displayName?: string;
}

interface PreviewSnapshot {
  /** The file the manifest was read from; null for a proposal held in memory. */
  path: string | null;
  basename: string;
  digest: string;
  manifest: AgentManifestV1;
  compatibility: ProfileCompatibility;
  compatibilityReasons: readonly string[];
  provenance: ReconProvenance | null;
}

interface DeleteSnapshot {
  profileId: string;
  revisionId: string;
}

export interface ProfileService {
  chooseFile(): Promise<{ fileHandle: string }>;
  previewImport(request: OperationRequest<'profiles.previewImport'>): Promise<ProfilePreviewView>;
  confirmImport(
    request: OperationRequest<'profiles.confirmImport'>,
  ): Promise<AgentProfileSummaryView>;
  list(request: OperationRequest<'profiles.list'>): OperationResponse<'profiles.list'>;
  get(request: OperationRequest<'profiles.get'>): AgentProfileDetailView;
  setEnabled(request: OperationRequest<'profiles.setEnabled'>): AgentProfileSummaryView;
  previewDelete(request: OperationRequest<'profiles.previewDelete'>): ProfileDeletionDisclosureView;
  confirmDelete(request: OperationRequest<'profiles.confirmDelete'>): AgentProfileSummaryView;
  /** Reuses the exact digest-bound import path for wizard completion. */
  saveReviewedManifest(
    manifest: AgentManifestV1,
    digest: string,
    sourceBasename: string,
    options?: ReviewedManifestOptions,
  ): AgentProfileSummaryView;
}

/**
 * The one bounded manifest read: the size check happens against the open
 * handle, so a file that grows after it was listed cannot be read past the
 * bound. Every untrusted manifest — picked file or recon proposal — uses it.
 */
export async function readBounded(path: string): Promise<{ raw: string; digest: string }> {
  let handle;
  try {
    handle = await open(path, 'r');
    const stats = await handle.stat();
    if (!stats.isFile() || stats.size > MAX_MANIFEST_BYTES) {
      throw new ThreadHelmError(
        'PROFILE_OVERSIZED',
        'Agent manifest exceeds the maximum read size.',
      );
    }
    const bytes = await handle.readFile();
    if (bytes.byteLength > MAX_MANIFEST_BYTES) {
      throw new ThreadHelmError(
        'PROFILE_OVERSIZED',
        'Agent manifest exceeds the maximum read size.',
      );
    }
    return {
      raw: bytes.toString('utf8'),
      digest: createHash('sha256').update(bytes).digest('hex'),
    };
  } catch (error) {
    if (error instanceof ThreadHelmError) throw error;
    throw new ThreadHelmError('PROFILE_UNREADABLE', 'The selected profile file is unavailable.');
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

export function createProfileService(ctx: Context): ProfileService {
  const handles = new Map<string, string>();
  const previews = new TokenStore<PreviewSnapshot>(TOKEN_TTL_MS, () => ctx.clock().getTime());
  const deletions = new TokenStore<DeleteSnapshot>(TOKEN_TTL_MS, () => ctx.clock().getTime());

  const repository = () => {
    if (!ctx.storage || ctx.health.degraded) {
      throw new ThreadHelmError('STORAGE_UNAVAILABLE', 'Agent-profile storage is unavailable.');
    }
    return ctx.storage.repositories.agentProfiles;
  };

  const emit = (summary: AgentProfileSummaryView, kind: ProfileEventKind): void => {
    ctx.events.emit(
      'profiles.changed',
      ProfileEventEnvelope.parse({
        type: 'profiles.changed',
        eventId: randomUUID(),
        profileId: summary.profileId,
        revisionId: summary.currentRevisionId,
        state: summary.state,
        compatibility: summary.compatibility,
        digestPrefix: summary.digestPrefix,
        kind,
        occurredAt: ctx.clock().toISOString(),
      }),
    );
  };

  const saveReviewedManifest = (
    manifest: AgentManifestV1,
    digest: string,
    sourceBasename: string,
    options?: ReviewedManifestOptions,
  ): AgentProfileSummaryView => {
    const compatibilityResult = evaluateManifestCompatibility(ctx, manifest);
    const input: ImportProfileManifestInput = {
      manifestKey: sourceBasename.toLocaleLowerCase('en-US'),
      digest,
      // The owner's name wins over the manifest's. A recon proposal always
      // carries a placeholder, so the roster shows what the owner typed.
      displayName: options?.displayName ?? manifest.name,
      description: manifest.description,
      requestedProvider: manifest.provider,
      requestedModel: manifest.model,
      capabilities: manifest.capabilities,
      isolateRequested: manifest.isolate,
      tokenCapRequested: manifest.tokenCap,
      author: manifest.author,
      goal: manifest.goal,
      manifestSpec: manifest.spec,
      compatibility: compatibilityResult.compatibility,
      compatibilityReasons: compatibilityResult.reasons,
      sourceBasename,
      createdAt: ctx.clock().toISOString(),
      reconRunId: options?.provenance?.reconRunId ?? null,
      derivedFromCommit: options?.provenance?.derivedFromCommit ?? null,
    };
    const imported = repository().importManifest(input);
    const summary = AgentProfileSummaryView.parse(repository().getSummary(imported.profileId)!);
    emit(summary, 'imported');
    return summary;
  };

  /** One preview path for both sources: file picker and recon proposal. */
  const snapshotPreview = (
    manifest: AgentManifestV1,
    digest: string,
    sourceBasename: string,
    path: string | null,
    provenance: ReconProvenance | null,
  ): ProfilePreviewView => {
    const compatibilityResult = evaluateManifestCompatibility(ctx, manifest);
    const issued = previews.issue({
      path,
      basename: sourceBasename,
      digest,
      manifest,
      compatibility: compatibilityResult.compatibility,
      compatibilityReasons: compatibilityResult.reasons,
      provenance,
    });
    return ProfilePreviewView.parse({
      previewToken: issued.token,
      digest,
      basename: sourceBasename,
      normalized: manifest,
      warnings: compatibilityResult.reasons,
      compatibility: compatibilityResult.compatibility,
      compatibilityReasons: compatibilityResult.reasons,
      expiresAt: issued.expiresAt,
    });
  };

  return {
    async chooseFile() {
      const selected = await ctx.profilePicker.pickFile();
      if (!selected)
        throw new ThreadHelmError('SELECTION_CANCELLED', 'No profile file was selected.');
      const fileHandle = randomUUID();
      handles.set(fileHandle, selected);
      while (handles.size > 32) handles.delete(handles.keys().next().value!);
      return { fileHandle };
    },

    async previewImport(request) {
      if (request.proposalId !== undefined) {
        // A proposal is single-use. An absent recon service and an already
        // reviewed proposal are the same fact to the owner: it is not there.
        const proposal = ctx.recon?.takeProposal(request.proposalId) ?? null;
        if (!proposal) {
          throw new ThreadHelmError(
            'PROFILE_UNREADABLE',
            'That proposed role is no longer available.',
          );
        }
        return snapshotPreview(proposal.manifest, proposal.digest, proposal.sourceBasename, null, {
          reconRunId: proposal.runId,
          derivedFromCommit: proposal.derivedFromCommit,
        });
      }
      const path = request.fileHandle !== undefined ? handles.get(request.fileHandle) : undefined;
      if (request.fileHandle !== undefined) handles.delete(request.fileHandle);
      if (!path) {
        throw new ThreadHelmError(
          'PROFILE_UNREADABLE',
          'The selected profile file is unavailable.',
        );
      }
      const { raw, digest } = await readBounded(path);
      return snapshotPreview(parseAgentManifest(raw), digest, basename(path), path, null);
    },

    async confirmImport(request) {
      const snapshot = previews.take(request.previewToken);
      if (!snapshot) {
        throw new ThreadHelmError(
          'CONFIRMATION_EXPIRED',
          'The profile preview expired or was used.',
        );
      }
      // Applied to both sources alike: acceptance is where the owner names the
      // role, whether the manifest came from a file or from a proposal.
      const options: ReviewedManifestOptions = {
        ...(snapshot.provenance ? { provenance: snapshot.provenance } : {}),
        ...(request.displayName !== undefined ? { displayName: request.displayName } : {}),
      };
      if (snapshot.path === null) {
        // A proposal's bytes left the run when it was taken and its directory
        // is gone; the reviewed manifest is the only copy and cannot drift.
        return saveReviewedManifest(snapshot.manifest, snapshot.digest, snapshot.basename, options);
      }
      const current = await readBounded(snapshot.path);
      let parsed: AgentManifestV1;
      try {
        parsed = parseAgentManifest(current.raw);
      } catch {
        throw new ThreadHelmError(
          'PROFILE_DIGEST_CHANGED',
          'The profile file changed after review.',
        );
      }
      if (
        current.digest !== snapshot.digest ||
        JSON.stringify(parsed) !== JSON.stringify(snapshot.manifest)
      ) {
        throw new ThreadHelmError(
          'PROFILE_DIGEST_CHANGED',
          'The profile file changed after review.',
        );
      }
      return saveReviewedManifest(snapshot.manifest, snapshot.digest, snapshot.basename, options);
    },

    list(request) {
      const options: Parameters<ReturnType<typeof repository>['list']>[0] = {};
      if (request?.state !== undefined) options.state = request.state;
      if (request?.compatibility !== undefined) options.compatibility = request.compatibility;
      if (request?.cursor !== undefined) options.cursor = request.cursor;
      if (request?.limit !== undefined) options.limit = request.limit;
      return repository().list(options);
    },

    get(request) {
      const detail = repository().getDetail(request.profileId);
      if (!detail)
        throw new ThreadHelmError('PROFILE_NOT_FOUND', 'The agent profile was not found.');
      return AgentProfileDetailView.parse(detail);
    },

    setEnabled(request) {
      const summary = AgentProfileSummaryView.parse(
        repository().setEnabled(
          request.profileId,
          request.revisionId,
          request.enabled,
          ctx.clock().toISOString(),
        ),
      );
      emit(summary, request.enabled ? 'enabled' : 'disabled');
      return summary;
    },

    previewDelete(request) {
      const preview = repository().previewDelete(request.profileId);
      const detail = repository().getDetail(request.profileId)!;
      const issued = deletions.issue({
        profileId: request.profileId,
        revisionId: detail.currentRevisionId,
      });
      return ProfileDeletionDisclosureView.parse({
        deleteToken: issued.token,
        profileId: preview.profileId,
        displayName: preview.displayName,
        expiresAt: issued.expiresAt,
      });
    },

    confirmDelete(request) {
      const snapshot = deletions.take(request.deleteToken);
      if (!snapshot) {
        throw new ThreadHelmError(
          'CONFIRMATION_EXPIRED',
          'The profile deletion review expired or was used.',
        );
      }
      const before = repository().getSummary(snapshot.profileId);
      if (!before || before.currentRevisionId !== snapshot.revisionId) {
        throw new ThreadHelmError(
          'PROFILE_REVISION_STALE',
          'The profile changed after deletion review.',
        );
      }
      repository().confirmDelete(snapshot.profileId, ctx.clock().toISOString());
      const deleted = AgentProfileSummaryView.parse({
        ...before,
        state: 'deleted',
        updatedAt: ctx.clock().toISOString(),
      });
      emit(deleted, 'deleted');
      return deleted;
    },
    saveReviewedManifest,
  };
}
