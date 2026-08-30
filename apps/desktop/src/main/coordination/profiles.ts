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
  type HireManifestV1,
  type OperationRequest,
  type OperationResponse,
  type ProfileCompatibility,
  type ProfileEventKind,
  type ProviderId,
} from '@threadhelm/contracts';
import {
  evaluateProfileCompatibility,
  MAX_MANIFEST_BYTES,
  parseHireManifest,
} from '@threadhelm/domain';
import type { ImportProfileManifestInput } from '@threadhelm/persistence';
import type { Context } from '../context.js';
import { TokenStore } from '../tokens.js';

const TESTED_MODELS: Readonly<Record<ProviderId, readonly string[]>> = {
  'claude-code': ['claude-opus-5', 'claude-sonnet-5'],
  'codex-cli': ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna'],
};

interface PreviewSnapshot {
  path: string;
  basename: string;
  digest: string;
  manifest: HireManifestV1;
  compatibility: ProfileCompatibility;
  compatibilityReasons: readonly string[];
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
}

async function readBounded(path: string): Promise<{ raw: string; digest: string }> {
  let handle;
  try {
    handle = await open(path, 'r');
    const stats = await handle.stat();
    if (!stats.isFile() || stats.size > MAX_MANIFEST_BYTES) {
      throw new ThreadHelmError(
        'PROFILE_OVERSIZED',
        'Hire manifest exceeds the maximum read size.',
      );
    }
    const bytes = await handle.readFile();
    if (bytes.byteLength > MAX_MANIFEST_BYTES) {
      throw new ThreadHelmError(
        'PROFILE_OVERSIZED',
        'Hire manifest exceeds the maximum read size.',
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
      const path = handles.get(request.fileHandle);
      handles.delete(request.fileHandle);
      if (!path) {
        throw new ThreadHelmError(
          'PROFILE_UNREADABLE',
          'The selected profile file is unavailable.',
        );
      }
      const { raw, digest } = await readBounded(path);
      const manifest = parseHireManifest(raw);
      const available = Object.fromEntries(
        ctx.adapters.map((adapter) => [adapter.id, TESTED_MODELS[adapter.id]]),
      );
      const compatibilityResult = evaluateProfileCompatibility({
        requestedProvider: manifest.provider,
        requestedModel: manifest.model,
        availableProviderModels: available,
      });
      const snapshot: PreviewSnapshot = {
        path,
        basename: basename(path),
        digest,
        manifest,
        compatibility: compatibilityResult.compatibility,
        compatibilityReasons: compatibilityResult.reasons,
      };
      const issued = previews.issue(snapshot);
      return ProfilePreviewView.parse({
        previewToken: issued.token,
        digest,
        basename: snapshot.basename,
        normalized: manifest,
        warnings: compatibilityResult.reasons,
        compatibility: compatibilityResult.compatibility,
        compatibilityReasons: compatibilityResult.reasons,
        expiresAt: issued.expiresAt,
      });
    },

    async confirmImport(request) {
      const snapshot = previews.take(request.previewToken);
      if (!snapshot) {
        throw new ThreadHelmError(
          'CONFIRMATION_EXPIRED',
          'The profile preview expired or was used.',
        );
      }
      const current = await readBounded(snapshot.path);
      let parsed: HireManifestV1;
      try {
        parsed = parseHireManifest(current.raw);
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
      const input: ImportProfileManifestInput = {
        manifestKey: snapshot.basename.toLocaleLowerCase('en-US'),
        digest: snapshot.digest,
        displayName: snapshot.manifest.name,
        description: snapshot.manifest.description,
        requestedProvider: snapshot.manifest.provider,
        requestedModel: snapshot.manifest.model,
        capabilities: snapshot.manifest.capabilities,
        isolateRequested: snapshot.manifest.isolate,
        tokenCapRequested: snapshot.manifest.tokenCap,
        author: snapshot.manifest.author,
        goal: snapshot.manifest.goal,
        manifestSpec: snapshot.manifest.spec,
        compatibility: snapshot.compatibility,
        compatibilityReasons: snapshot.compatibilityReasons,
        sourceBasename: snapshot.basename,
        createdAt: ctx.clock().toISOString(),
      };
      const imported = repository().importManifest(input);
      const summary = AgentProfileSummaryView.parse(repository().getSummary(imported.profileId)!);
      emit(summary, 'imported');
      return summary;
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
  };
}
