/**
 * The launch disclosure facts, shared by every dialog that confirms a session.
 *
 * Extracted from `LaunchDialog` so the recon disclosure discloses the same
 * resolved facts an ordinary launch does — model and effort with their
 * sources, the runtime permission with its source and provider mapping, the
 * execution bounds ThreadHelm actually enforces, and the coordination bridge
 * notice. A gate that shows less than the application can prove is the one
 * thing this product does not do.
 *
 * The markup here is byte-for-byte what `LaunchDialog` rendered before the
 * extraction, in the same order. `extraFacts` is appended inside the same
 * `<dl>`; an ordinary launch passes nothing and renders exactly as it did.
 */

import type { ReactNode } from 'react';
import type { LaunchPreviewView } from '@threadhelm/contracts';

function abbreviate(path: string | null): string {
  if (!path) return 'unknown';
  return path.length > 60 ? `…${path.slice(-57)}` : path;
}

function sourceLabel(kind: LaunchPreviewView['runtimeResolution']['modelSource']['kind']): string {
  switch (kind) {
    case 'one_run':
      return 'One-run choice';
    case 'profile_revision':
      return 'Exact profile revision';
    case 'task_type_policy':
      return 'Task-type policy';
    case 'project_policy':
      return 'Project policy';
    case 'cli_default':
      return 'CLI default';
  }
}

export function LaunchDisclosureFacts({
  preview,
  extraFacts,
}: {
  preview: LaunchPreviewView;
  /** Dialog-specific rows appended to the shared ones, inside the same list. */
  extraFacts?: ReactNode;
}) {
  return (
    <>
      <dl className="facts">
        <dt>Agent</dt>
        <dd>
          {preview.readiness.displayName} {preview.readiness.version ?? '(version unknown)'}
        </dd>
        <dt>Executable</dt>
        <dd className="mono" title={preview.readiness.resolvedExecutable ?? ''}>
          {abbreviate(preview.readiness.resolvedExecutable)}
        </dd>
        <dt>Authentication</dt>
        <dd>{preview.readiness.authentication}</dd>
        <dt>Model</dt>
        <dd>{preview.runtimeSelection.model ?? 'CLI default'}</dd>
        <dt>Model source</dt>
        <dd>{sourceLabel(preview.runtimeResolution.modelSource.kind)}</dd>
        <dt>Effort</dt>
        <dd>
          {preview.runtimeSelection.effort
            ? preview.runtimeSelection.effort === 'xhigh'
              ? 'Extra high'
              : preview.runtimeSelection.effort === 'max'
                ? 'Maximum'
                : `${preview.runtimeSelection.effort[0]!.toUpperCase()}${preview.runtimeSelection.effort.slice(1)}`
            : 'CLI default'}
        </dd>
        <dt>Effort source</dt>
        <dd>{sourceLabel(preview.runtimeResolution.effortSource.kind)}</dd>
        <dt>Runtime permission</dt>
        <dd>{preview.permissionResolution.policy.replaceAll('_', ' ')}</dd>
        <dt>Permission source</dt>
        <dd>{preview.permissionResolution.source.replaceAll('_', ' ')}</dd>
        <dt>Provider mapping</dt>
        <dd>{preview.permissionResolution.providerMapping?.replaceAll('_', ' ') ?? 'held'}</dd>
        <dt>Execution bounds</dt>
        <dd>
          {Math.round(preview.executionBounds.maxElapsedMs / 60_000)} min ·{' '}
          {preview.executionBounds.maxTurns} turns ·{' '}
          {Math.round(preview.executionBounds.maxNoProgressMs / 60_000)} min without progress
          {' · '}
          {preview.executionBounds.maxOutputBytes} output bytes
          {' · '}
          {preview.executionBounds.maxConcurrentProcesses} contained processes
        </dd>
        <dt>Effective folder</dt>
        <dd className="mono">{preview.workspace.displayPath}</dd>
        {preview.workspace.displayPath !== preview.workspace.selectedPath ? (
          <>
            <dt>Selected as</dt>
            <dd className="mono">{preview.workspace.selectedPath}</dd>
          </>
        ) : null}
        <dt>Terminal</dt>
        <dd>
          {preview.terminal.columns}×{preview.terminal.rows}
        </dd>
        {preview.coordinationBridge ? (
          <>
            <dt>Local coordination</dt>
            <dd>{preview.coordinationBridge.tools.join(', ')}</dd>
          </>
        ) : null}
        {extraFacts}
      </dl>
      {preview.coordinationBridge ? (
        <p className="notice">
          This session receives a local coordination tool. Messages and replies are stored durably
          only when deliberately created. If the bridge is unavailable, the session stays running
          and coordination falls back to manual presentation.
        </p>
      ) : null}
      {preview.permissionResolution.disposition === 'held' ? (
        <p className="notice warning" role="status">
          This permission choice is held. Choose Manual
          {preview.permissionResolution.fallbackActions.includes('bounded_allowlist')
            ? ' or provide a bounded allowlist'
            : ''}
          . ThreadHelm will not substitute bypass permission.
        </p>
      ) : null}
    </>
  );
}
