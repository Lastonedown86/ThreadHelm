/**
 * Per-session launch disclosure (T047). Shows the effective path, agent,
 * version, executable, and the boundary warning; requires a fresh explicit
 * confirmation every time. Nothing here is remembered between sessions.
 */

import { useEffect, useState } from 'react';
import type {
  LaunchEffort,
  LaunchPreviewView,
  LaunchWorkType,
  RuntimePermissionPolicy,
  ProviderExecutionBounds,
  SessionView,
} from '@threadhelm/contracts';
import { api, call } from '../../api.js';
import { Modal } from '../control/Modal.js';
import type { LaunchRequest } from '../../store.js';
import { LaunchError } from './LaunchErrors.js';

interface Props {
  request: LaunchRequest;
  terminal: { columns: number; rows: number };
  onLaunched: (session: SessionView) => void;
  onCancel: () => void;
}

const CUSTOM_MODEL = '__custom__';

const MODEL_OPTIONS = {
  'codex-cli': [
    { value: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
    { value: 'gpt-5.6-terra', label: 'GPT-5.6 Terra' },
    { value: 'gpt-5.6-luna', label: 'GPT-5.6 Luna' },
    { value: 'gpt-5.5', label: 'GPT-5.5' },
    { value: 'gpt-5.4', label: 'GPT-5.4' },
    { value: 'gpt-5.4-mini', label: 'GPT-5.4 Mini' },
    { value: 'gpt-5.3-codex-spark', label: 'GPT-5.3 Codex Spark' },
  ],
  'claude-code': [
    { value: 'fable', label: 'Claude Fable 5' },
    { value: 'opus', label: 'Claude Opus' },
    { value: 'sonnet', label: 'Claude Sonnet' },
  ],
} as const;

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

function modelLabel(providerId: keyof typeof MODEL_OPTIONS, model: string): string {
  return MODEL_OPTIONS[providerId].find((option) => option.value === model)?.label ?? model;
}

export function LaunchDialog({ request, terminal, onLaunched, onCancel }: Props) {
  const [preview, setPreview] = useState<LaunchPreviewView | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [model, setModel] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [effort, setEffort] = useState<LaunchEffort | ''>('');
  const [workType, setWorkType] = useState<LaunchWorkType>('general');
  const [runtimeEscalationReason, setRuntimeEscalationReason] = useState('');
  const [permission, setPermission] = useState<RuntimePermissionPolicy | ''>('');
  const [allowlist, setAllowlist] = useState('');
  const [executionBounds, setExecutionBounds] = useState<ProviderExecutionBounds | undefined>();

  useEffect(() => {
    setPreview(null);
    setConfirmed(false);
    setModel('');
    setCustomModel('');
    setEffort('');
    setWorkType('general');
    setRuntimeEscalationReason('');
    setPermission('');
    setAllowlist('');
    setExecutionBounds(undefined);
  }, [request.workspaceId, request.providerId]);

  const selectedModel = model === CUSTOM_MODEL ? customModel : model;
  const modelReady = model !== CUSTOM_MODEL || customModel.trim().length > 0;
  const boundedAllowlist = allowlist
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);
  const permissionReady = permission !== 'bounded_allowlist' || boundedAllowlist.length > 0;

  useEffect(() => {
    let cancelled = false;
    if (!modelReady || !permissionReady) {
      setPreview(null);
      setError(null);
      setChecking(false);
      return;
    }

    setChecking(true);
    setError(null);
    const timer = window.setTimeout(
      () => {
        call(
          api.sessions.previewLaunch({
            workspaceId: request.workspaceId,
            providerId: request.providerId,
            terminal,
            runtimeSelection: {
              model: selectedModel.trim() || null,
              effort: effort || null,
            },
            workType,
            runtimeEscalationReason:
              runtimeEscalationReason.trim().length >= 20 ? runtimeEscalationReason.trim() : null,
            permissionSelection: {
              policy: permission || null,
              boundedAllowlist: permission === 'bounded_allowlist' ? boundedAllowlist : [],
            },
            executionBounds,
          }),
        )
          .then((view) => {
            if (!cancelled) setPreview(view);
          })
          .catch((err: unknown) => {
            if (!cancelled) {
              setPreview(null);
              setError(err);
            }
          })
          .finally(() => {
            if (!cancelled) setChecking(false);
          });
      },
      model === CUSTOM_MODEL ? 350 : 0,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    request.workspaceId,
    request.providerId,
    terminal.columns,
    terminal.rows,
    selectedModel,
    effort,
    workType,
    runtimeEscalationReason,
    model,
    modelReady,
    permission,
    allowlist,
    permissionReady,
    executionBounds,
  ]);

  const launch = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const session = await call(
        api.sessions.launch({
          previewToken: preview.previewToken,
          boundaryConfirmation: confirmed,
        }),
      );
      onLaunched(session);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <Modal title="Review this launch" onCancel={onCancel} describedBy="launch-boundary">
      <fieldset className="launch-settings">
        <legend>Provider runtime</legend>
        <label className="field">
          Work type
          <select
            value={workType}
            onChange={(event) => setWorkType(event.target.value as LaunchWorkType)}
          >
            <option value="general">General work</option>
            <option value="test_authoring">Test authoring</option>
            <option value="failure_analysis">Test failure analysis</option>
          </select>
        </label>
        <label className="field">
          Model
          <select
            value={model}
            onChange={(event) => {
              setModel(event.target.value);
              if (event.target.value !== CUSTOM_MODEL) setCustomModel('');
            }}
          >
            <option value="">CLI default</option>
            {MODEL_OPTIONS[request.providerId].map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            <option value={CUSTOM_MODEL}>Custom model…</option>
          </select>
        </label>
        {model === CUSTOM_MODEL ? (
          <label className="field">
            Custom model identifier
            <input
              value={customModel}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setCustomModel(event.target.value)}
            />
          </label>
        ) : null}
        <label className="field">
          Effort
          <select
            value={effort}
            onChange={(event) => setEffort(event.target.value as LaunchEffort | '')}
          >
            <option value="">CLI default</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="xhigh">Extra high</option>
            <option value="max">Maximum</option>
          </select>
        </label>
        <p className="hint">
          CLI default preserves the provider's local settings. Routine test commands need no model;
          for test authoring or failure summaries, prefer a lower-cost model at Low or Medium.
        </p>
        <label className="field">
          Runtime permission
          <select
            value={permission}
            onChange={(event) => {
              setPermission(event.target.value as RuntimePermissionPolicy | '');
              if (event.target.value !== 'bounded_allowlist') setAllowlist('');
            }}
          >
            <option value="">Provider default (Manual)</option>
            <option value="manual">Manual</option>
            <option value="auto">Automatic provider classifier</option>
            <option value="bounded_allowlist">Bounded allowlist</option>
          </select>
        </label>
        {permission === 'bounded_allowlist' ? (
          <label className="field">
            Allowed provider tools
            <textarea
              value={allowlist}
              rows={3}
              placeholder="Read, Glob, Grep"
              onChange={(event) => setAllowlist(event.target.value)}
            />
          </label>
        ) : null}
        <label className="field">
          Contained process limit
          <input
            type="number"
            min={1}
            max={16}
            value={
              executionBounds?.maxConcurrentProcesses ??
              preview?.executionBounds.maxConcurrentProcesses ??
              1
            }
            disabled={busy || (!preview && !executionBounds)}
            onChange={(event) => {
              const prior = executionBounds ?? preview?.executionBounds;
              if (prior)
                setExecutionBounds({
                  ...prior,
                  maxConcurrentProcesses: Number(event.target.value),
                });
            }}
          />
        </label>
        <p className="hint">
          This limit includes the provider and its terminal/bridge helpers. Mission workers commonly
          need more than one process; review and authorize the exact limit before launching.
        </p>
        <p className="hint">
          Permission is resolved for this launch by ThreadHelm, never by the agent persona.
          Automatic mode starts only with exact provider capability evidence. Break-glass bypass is
          unavailable in this ordinary local launch because disposable isolation has not been
          proved.
        </p>
      </fieldset>
      {checking ? (
        <p className="hint" role="status">
          Updating the launch preview…
        </p>
      ) : null}
      {preview ? (
        <>
          {preview.runtimeResolution.recommendation ? (
            <p className="notice">
              Recommended for this work:{' '}
              {modelLabel(request.providerId, preview.runtimeResolution.recommendation.model)} at{' '}
              {preview.runtimeResolution.recommendation.effort === 'low' ? 'Low' : 'Medium'}.{' '}
              {preview.runtimeResolution.recommendation.reason}
            </p>
          ) : null}
          {preview.runtimeResolution.requiresEscalationReason ? (
            <label className="field">
              Escalation reason
              <textarea
                value={runtimeEscalationReason}
                rows={2}
                minLength={20}
                maxLength={500}
                placeholder="Why this higher-cost model or effort is required"
                onChange={(event) => setRuntimeEscalationReason(event.target.value)}
              />
            </label>
          ) : null}
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
          </dl>
          {preview.coordinationBridge ? (
            <p className="notice">
              This session receives a local coordination tool. Messages and replies are stored
              durably only when deliberately created. If the bridge is unavailable, the session
              stays running and coordination falls back to manual presentation.
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
          {preview.runtimeResolution.disposition === 'held' ? (
            <p className="notice warning" role="status">
              Record why this higher-cost model or effort is required before launch. The reason is
              bound to this one-run preview.
            </p>
          ) : null}
          <p id="launch-boundary" className="notice warning">
            {preview.boundaryWarning}
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            I understand ThreadHelm cannot confine this agent to the folder.
          </label>
        </>
      ) : error || !modelReady || !permissionReady ? null : (
        <p>Checking the folder and agent…</p>
      )}
      <LaunchError error={error} />
      <div className="actions">
        <button type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => void launch()}
          disabled={
            !preview ||
            preview.permissionResolution.disposition !== 'ready' ||
            preview.runtimeResolution.disposition !== 'ready' ||
            !confirmed ||
            busy ||
            checking
          }
        >
          Launch session
        </button>
      </div>
    </Modal>
  );
}
