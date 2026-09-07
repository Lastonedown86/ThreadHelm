import { CUSTOM_MODEL, MODEL_OPTIONS, ModelPicker } from './ModelPicker.js';
/**
 * Per-session launch disclosure (T047). Shows the effective path, agent,
 * version, executable, and the boundary warning; requires a fresh explicit
 * confirmation every time. Nothing here is remembered between sessions.
 */

import { useEffect, useRef, useState } from 'react';
import type {
  LaunchEffort,
  LaunchPreviewView,
  LaunchWorkType,
  RuntimePermissionPolicy,
  ProviderExecutionBounds,
  SessionView,
} from '@threadhelm/contracts';
import { api, call, errorCode, RendererError } from '../../api.js';
import { Modal } from '../control/Modal.js';
import type { LaunchRequest } from '../../store.js';
import { LaunchDisclosureFacts } from './LaunchDisclosureFacts.js';
import { LaunchError } from './LaunchErrors.js';

interface Props {
  request: LaunchRequest;
  terminal: { columns: number; rows: number };
  onLaunched: (session: SessionView) => void;
  onCancel: () => void;
}

function modelLabel(providerId: keyof typeof MODEL_OPTIONS, model: string): string {
  return MODEL_OPTIONS[providerId].find((option) => option.value === model)?.label ?? model;
}

export function LaunchDialog({ request, terminal, onLaunched, onCancel }: Props) {
  const launching = useRef(false);
  const refreshing = useRef(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [recovery, setRecovery] = useState(false);
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

  const reviewKey = JSON.stringify([
    request.workspaceId,
    request.providerId,
    terminal.columns,
    terminal.rows,
    model,
    selectedModel,
    effort,
    workType,
    runtimeEscalationReason,
    permission,
    allowlist,
    executionBounds,
    refreshVersion,
  ]);
  const reviewCurrent = preview !== null && previewKey === reviewKey && !recovery;

  useEffect(() => {
    let cancelled = false;
    if (!modelReady || !permissionReady) {
      setPreview(null);
      setError(null);
      setChecking(false);
      refreshing.current = false;
      return;
    }

    setChecking(true);
    setError(null);
    setRecovery(false);
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
            if (!cancelled) {
              setPreview(view);
              setPreviewKey(reviewKey);
            }
          })
          .catch((err: unknown) => {
            if (!cancelled) {
              setPreview(null);
              setError(err);
              setConfirmed(false);
              setRecovery(true);
            }
          })
          .finally(() => {
            if (!cancelled) {
              setChecking(false);
              refreshing.current = false;
            }
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
    refreshVersion,
  ]);

  const expire = () => {
    setConfirmed(false);
    setRecovery(true);
    setError(
      new RendererError({ code: 'PREVIEW_EXPIRED', message: 'Launch review expired', details: {} }),
    );
  };
  useEffect(() => {
    if (!preview || !reviewCurrent || busy) return;
    const timer = window.setTimeout(
      expire,
      Math.max(0, Date.parse(preview.expiresAt) - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [preview, reviewCurrent, busy]);

  const refresh = () => {
    if (launching.current || refreshing.current || checking) return;
    refreshing.current = true;
    setConfirmed(false);
    setChecking(true);
    setRefreshVersion((version) => version + 1);
  };
  const cancel = () => {
    if (!launching.current) onCancel();
  };
  const launch = async () => {
    if (
      !preview ||
      !reviewCurrent ||
      checking ||
      !confirmed ||
      launching.current ||
      preview.permissionResolution.disposition !== 'ready' ||
      preview.runtimeResolution.disposition !== 'ready'
    )
      return;
    if (Date.parse(preview.expiresAt) <= Date.now()) {
      expire();
      return;
    }
    launching.current = true;
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
      setConfirmed(false);
      setRecovery(true);
    } finally {
      launching.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal title="Review this launch" onCancel={cancel} describedBy="launch-boundary">
      <fieldset className="launch-settings" disabled={busy}>
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
        <ModelPicker
          providerId={request.providerId}
          choice={model}
          customModel={customModel}
          onChoice={(value) => {
            setModel(value);
            if (value !== CUSTOM_MODEL) setCustomModel('');
          }}
          onCustom={setCustomModel}
        />
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
                disabled={busy}
                rows={2}
                minLength={20}
                maxLength={500}
                placeholder="Why this higher-cost model or effort is required"
                onChange={(event) => setRuntimeEscalationReason(event.target.value)}
              />
            </label>
          ) : null}
          <LaunchDisclosureFacts preview={preview} />
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
              disabled={!reviewCurrent || checking || busy}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            I understand ThreadHelm cannot confine this agent to the folder.
          </label>
        </>
      ) : error || !modelReady || !permissionReady ? null : (
        <p>Checking the folder and agent…</p>
      )}
      {errorCode(error) === 'PREVIEW_EXPIRED' ? (
        <p className="notice error" role="alert">
          This launch review expired. Refresh review, check the current facts, and confirm again.
        </p>
      ) : (
        <LaunchError error={error} />
      )}
      {recovery ? (
        <p className="hint">
          Your settings are preserved. Refresh review before trying to launch again.
        </p>
      ) : null}
      <div className="actions">
        <button type="button" onClick={cancel} disabled={busy}>
          Cancel
        </button>
        {recovery ? (
          <button
            type="button"
            onClick={refresh}
            disabled={checking || busy || !modelReady || !permissionReady}
          >
            Refresh review
          </button>
        ) : null}
        <button
          type="button"
          className="primary"
          onClick={() => void launch()}
          disabled={
            !preview ||
            !reviewCurrent ||
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
