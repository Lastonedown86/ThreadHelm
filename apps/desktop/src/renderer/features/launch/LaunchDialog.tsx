/**
 * Per-session launch disclosure (T047). Shows the effective path, agent,
 * version, executable, and the boundary warning; requires a fresh explicit
 * confirmation every time. Nothing here is remembered between sessions.
 */

import { useEffect, useState } from 'react';
import type { LaunchEffort, LaunchPreviewView, SessionView } from '@threadhelm/contracts';
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

export function LaunchDialog({ request, terminal, onLaunched, onCancel }: Props) {
  const [preview, setPreview] = useState<LaunchPreviewView | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [model, setModel] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [effort, setEffort] = useState<LaunchEffort | ''>('');

  useEffect(() => {
    setPreview(null);
    setConfirmed(false);
    setModel('');
    setCustomModel('');
    setEffort('');
  }, [request.workspaceId, request.providerId]);

  const selectedModel = model === CUSTOM_MODEL ? customModel : model;
  const modelReady = model !== CUSTOM_MODEL || customModel.trim().length > 0;

  useEffect(() => {
    let cancelled = false;
    if (!modelReady) {
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
    model,
    modelReady,
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
      </fieldset>
      {checking ? (
        <p className="hint" role="status">
          Updating the launch preview…
        </p>
      ) : null}
      {preview ? (
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
      ) : error || !modelReady ? null : (
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
          disabled={!preview || !confirmed || busy || checking}
        >
          Launch session
        </button>
      </div>
    </Modal>
  );
}
