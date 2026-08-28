/**
 * Canonical workspace identity through the native module (T038).
 *
 * Identity is (volume serial, file id) from an opened handle — never a path
 * string. Unsupported volumes and native failures map to stable contract
 * codes; native error strings never reach the renderer.
 */

import { ThreadHelmError, type WorkspaceIdentity } from '@threadhelm/contracts';
import type { Context } from '../context.js';

export interface ResolvedWorkspace {
  selectedPath: string;
  canonicalPath: string;
  displayPath: string;
  identity: WorkspaceIdentity;
  isReparsePoint: boolean;
}

function nativeCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split(' ')[0] ?? 'UNKNOWN';
}

export function resolveWorkspace(ctx: Context, selectedPath: string): ResolvedWorkspace {
  let raw;
  try {
    raw = ctx.native.resolveDirectory(selectedPath);
  } catch (error) {
    const code = nativeCode(error);
    ctx.log.warn('workspace.resolve_failed', { nativeCode: code });
    switch (code) {
      case 'DIRECTORY_NOT_FOUND':
      case 'DIRECTORY_ACCESS_DENIED':
        throw new ThreadHelmError('WORKSPACE_NOT_FOUND', 'The folder is missing or inaccessible.', {
          nativeCode: code,
        });
      case 'DIRECTORY_UNSUPPORTED':
        throw new ThreadHelmError(
          'WORKSPACE_UNSUPPORTED',
          'Only folders on fixed local drives are supported in this release. Network, removable, UNC, and device paths are not.',
          { nativeCode: code },
        );
      default:
        throw new ThreadHelmError(
          'WORKSPACE_AMBIGUOUS',
          'The folder identity could not be established reliably.',
          { nativeCode: code },
        );
    }
  }
  if (raw.driveType !== 'fixed') {
    throw new ThreadHelmError('WORKSPACE_UNSUPPORTED', 'Only fixed local drives are supported.', {
      driveType: raw.driveType,
    });
  }
  return {
    selectedPath: raw.selectedPath,
    canonicalPath: raw.canonicalPath,
    displayPath: raw.displayPath,
    identity: { volumeSerial: raw.volumeSerial, fileId: raw.fileId },
    isReparsePoint: raw.isReparsePoint,
  };
}

export function sameIdentity(a: WorkspaceIdentity, b: WorkspaceIdentity): boolean {
  return a.volumeSerial === b.volumeSerial && a.fileId === b.fileId;
}

/**
 * Re-open the directory and require the identity recorded at approval.
 * Any mismatch makes the approval stale (data-model invariant 2).
 */
export function revalidateWorkspace(
  ctx: Context,
  workspace: { id: string; selectedPath: string; volumeSerial: string; fileId: string },
): ResolvedWorkspace {
  let resolved: ResolvedWorkspace;
  try {
    resolved = resolveWorkspace(ctx, workspace.selectedPath);
  } catch (error) {
    if (error instanceof ThreadHelmError) {
      throw new ThreadHelmError(
        'WORKSPACE_CHANGED',
        'The approved folder is no longer available as approved. Review and re-approve it.',
        { workspaceId: workspace.id, reason: error.code },
      );
    }
    throw error;
  }
  if (!sameIdentity(resolved.identity, workspace)) {
    throw new ThreadHelmError(
      'WORKSPACE_CHANGED',
      'The folder at this path is not the one that was approved. Review and re-approve it.',
      { workspaceId: workspace.id, reason: 'IDENTITY_MISMATCH' },
    );
  }
  return resolved;
}
