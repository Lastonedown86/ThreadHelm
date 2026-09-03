/**
 * Workspace Recon (T6): the roster region on an approved workspace. Recon is
 * an ordinary, owner-confirmed session — same disclosure, same boundary
 * warning, same terminal dock presence — whose only return channel is a
 * proposed set of agent manifests. Nothing here hires anyone: every proposed
 * role is reviewed and accepted through the existing profile-import gate, one
 * role at a time, and there is no accept-all control.
 *
 * Design: docs/superpowers/specs/2026-09-02-workspace-recon-design.md
 */

import { useEffect, useState } from 'react';
import type {
  ProfilePreviewView,
  ProviderId,
  ReconLaunchPreviewView,
  ReconOutcome,
  ReconProposalView,
  ReconRunView,
} from '@threadhelm/contracts';
import { api, call } from '../../api.js';
import { useStore } from '../../store.js';
import { Modal } from '../control/Modal.js';
import { AgentProfileImportPreview } from '../coordination/AgentProfileDetail.js';
import { LaunchDisclosureFacts } from '../launch/LaunchDisclosureFacts.js';
import { LaunchError } from '../launch/LaunchErrors.js';

/** Every outcome gets its own sentence; there is no blanket failure text. */
const OUTCOME_TEXT: Record<ReconOutcome, string> = {
  completed: 'Recon finished and every file it wrote was read.',
  partial: 'Recon finished. Some files could not be read.',
  no_output: 'Recon finished without writing any roles.',
  unparsable_output: 'Recon wrote files, but none could be read as a role.',
  stopped_by_owner: 'You stopped this recon run.',
  token_cap_reached: 'Recon reached its token cap for this run.',
  provider_unauthenticated: 'The provider was not authenticated, so recon did not run.',
};

const COMPATIBILITY_LABEL: Record<string, string> = {
  compatible: 'Compatible',
  incompatible_provider: 'Incompatible provider',
  incompatible_model: 'Incompatible model',
  unavailable: 'Unavailable',
};

const ROLE_LABEL: Record<ReconProposalView['role'], string> = {
  supervisor: 'Supervisor',
  specialist: 'Specialist',
};

/** No session is selected yet, so there is no live terminal size to reuse. */
const DEFAULT_TERMINAL = { columns: 120, rows: 30 };

/** Supervisor first, then specialists in name order (the placeholder name ties break stably). */
function sortProposals(proposals: ReconProposalView[]): ReconProposalView[] {
  return [...proposals].sort((a, b) => {
    if (a.role !== b.role) return a.role === 'supervisor' ? -1 : 1;
    return a.manifest.name.localeCompare(b.manifest.name);
  });
}

function ReconDisclosureDialog({
  workspaceId,
  providers,
  onCancel,
  onStarted,
}: {
  workspaceId: string;
  providers: { providerId: ProviderId; displayName: string }[];
  onCancel(): void;
  onStarted(run: ReconRunView): void;
}) {
  const [providerId, setProviderId] = useState<ProviderId | ''>(providers[0]?.providerId ?? '');
  const [preview, setPreview] = useState<ReconLaunchPreviewView | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    setPreview(null);
    setConfirmed(false);
    setError(null);
    if (!providerId) return;
    let cancelled = false;
    setChecking(true);
    void call(
      api.workspaceRecon.previewLaunch({ workspaceId, providerId, terminal: DEFAULT_TERMINAL }),
    )
      .then((view) => {
        if (!cancelled) setPreview(view);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, providerId]);

  const start = async () => {
    if (!preview || !confirmed) return;
    setBusy(true);
    setError(null);
    try {
      const run = await call(
        api.workspaceRecon.confirmLaunch({
          previewToken: preview.launch.previewToken,
          boundaryConfirmation: true,
        }),
      );
      onStarted(run);
    } catch (cause) {
      setError(cause);
      setBusy(false);
    }
  };

  return (
    <Modal title="Run recon" onCancel={onCancel} describedBy="recon-boundary">
      {providers.length === 0 ? (
        <p className="hint">No agent tool is ready. Make one available, then run recon.</p>
      ) : (
        <>
          {providers.length > 1 ? (
            <label className="field">
              Agent
              <select
                value={providerId}
                onChange={(event) => setProviderId(event.target.value as ProviderId)}
              >
                {providers.map((provider) => (
                  <option key={provider.providerId} value={provider.providerId}>
                    {provider.displayName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {checking ? (
            <p className="hint" role="status">
              Checking the folder and agent…
            </p>
          ) : null}
          {preview ? (
            <>
              {/*
                The same facts an ordinary launch discloses — model, effort,
                permission and, above all, the execution bounds ThreadHelm can
                actually enforce — plus the two recon adds. A recon session has
                full workspace reach; this gate discloses no less than any other.
              */}
              <LaunchDisclosureFacts
                preview={preview.launch}
                extraFacts={
                  <>
                    <dt>Output directory</dt>
                    <dd className="mono">{preview.outputDirectory}</dd>
                    <dt>Token cap requested of the agent</dt>
                    <dd>{preview.tokenCapRequested.toLocaleString()}</dd>
                  </>
                }
              />
              <p className="notice">{preview.autoHireStatement}</p>
              <h3>Recon prompt</h3>
              <pre>{preview.reconPrompt}</pre>
              <p id="recon-boundary" className="notice warning">
                {preview.launch.boundaryWarning}
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
          ) : null}
        </>
      )}
      <LaunchError error={error} />
      <div className="actions">
        <button type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => void start()}
          disabled={!preview || !confirmed || busy || checking}
        >
          Start recon
        </button>
      </div>
    </Modal>
  );
}

export function WorkspaceRoster({
  workspaceId,
  displayPath,
}: {
  workspaceId: string;
  displayPath: string;
}) {
  const { state } = useStore();
  const [run, setRun] = useState<ReconRunView | null>(null);
  const [disclosureOpen, setDisclosureOpen] = useState(false);
  const [reviewPreview, setReviewPreview] = useState<{
    proposalId: string;
    preview: ProfilePreviewView;
  } | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    void call(api.workspaceRecon.getRun({ workspaceId })).then(
      (view) => {
        if (!cancelled) setRun(view);
      },
      (cause: unknown) => {
        if (!cancelled) setError(cause);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  // Collection runs after the session's teardown signal, which reaches the
  // renderer as `session.changed`; state.sessions is already kept live by it.
  // No dedicated recon event exists, so once that session has ended this
  // polls getRun up to 5 times, 300ms apart, to bridge the short gap until
  // collection finishes, then stops for good. It never runs while idle.
  // ponytail: bounded poll, not a background interval; add a recon.changed
  // event instead if this ever proves flaky in practice.
  //
  // Keyed only on runId/sessionId/outcome/sessionEndedAt (all primitives that
  // stay constant for the life of one poll sequence) rather than the whole
  // `run` object: each `setRun` below creates a new object reference, so
  // depending on `run` itself would tear down and restart this effect on
  // every poll response — resetting `attempts` to 0 and dropping the 300ms
  // spacing, turning "bounded poll" into an unbounded one racing the IPC
  // round-trip. Confirmed via a manual instrumented run (logged each
  // `attempts` value and watched it stop): the real fixture case resolves in
  // exactly 2 attempts, strictly increasing, then nothing further for 4.5s.
  const runId = run?.runId;
  const sessionId = run?.sessionId ?? null;
  const outcome = run?.outcome ?? null;
  const sessionEndedAt = (sessionId ? state.sessions[sessionId] : undefined)?.endedAt;
  useEffect(() => {
    if (!runId || outcome !== null || !sessionId || !sessionEndedAt) return;
    let cancelled = false;
    let attempts = 0;
    const poll = () => {
      if (cancelled) return;
      attempts += 1;
      void call(api.workspaceRecon.getRun({ workspaceId })).then((next) => {
        if (cancelled) return;
        setRun(next);
        if (next && next.outcome === null && attempts < 5) window.setTimeout(poll, 300);
      });
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, runId, outcome, sessionId, sessionEndedAt]);

  const availableProviders = state.readiness
    .filter((readiness) => readiness.availability === 'available')
    .map((readiness) => ({ providerId: readiness.providerId, displayName: readiness.displayName }));

  const review = async (proposalId: string) => {
    setError(null);
    try {
      // A peek on the main side: the proposal stays listed until the owner
      // accepts it, so cancelling this dialog loses nothing.
      const preview = await call(api.profiles.previewImport({ proposalId }));
      setReviewPreview({ proposalId, preview });
    } catch (cause) {
      setError(cause);
    }
  };

  const runRecon = () => setDisclosureOpen(true);

  const headingId = `roster-heading-${workspaceId}`;

  const proposals = run ? sortProposals(run.proposals) : [];

  return (
    <section className="panel roster" aria-labelledby={headingId}>
      <h2 id={headingId}>Roster</h2>
      {!run ? (
        <p>No roster yet. Recon can read this workspace and propose one.</p>
      ) : (
        <>
          <p role="status">{run.outcome ? OUTCOME_TEXT[run.outcome] : 'Recon is running.'}</p>
          {run.outcome && !run.promptSubmitted ? (
            <p className="notice warning">
              ThreadHelm could not deliver the recon prompt to this session.
            </p>
          ) : null}
          {proposals.length > 0 ? (
            <ul className="list" aria-label={`Proposed roles for ${displayPath}`}>
              {proposals.map((proposal) => (
                <li key={proposal.proposalId}>
                  <strong>{ROLE_LABEL[proposal.role]}</strong>{' '}
                  <span className={`badge profile-${proposal.compatibility}`}>
                    {COMPATIBILITY_LABEL[proposal.compatibility] ?? proposal.compatibility}
                  </span>
                  <p>{proposal.manifest.goal}</p>
                  <p className="hint">
                    {proposal.manifest.capabilities.length > 0
                      ? proposal.manifest.capabilities.join(', ')
                      : 'No capabilities listed'}
                  </p>
                  <button
                    type="button"
                    disabled={state.storageDegraded}
                    onClick={() => void review(proposal.proposalId)}
                  >
                    Review
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {run.rejected.length > 0 ? (
            <ul className="list" aria-label="Files recon could not use">
              {run.rejected.map((rejection) => (
                <li key={rejection.sourceBasename}>
                  {rejection.sourceBasename} — {rejection.errorCode}
                </li>
              ))}
            </ul>
          ) : null}
          {run.ignoredFileCount > 0 ? (
            <p className="hint">{run.ignoredFileCount} further files were not read.</p>
          ) : null}
        </>
      )}
      <LaunchError error={error} />
      <button type="button" disabled={state.storageDegraded} onClick={runRecon}>
        Run recon
      </button>
      {disclosureOpen ? (
        <ReconDisclosureDialog
          workspaceId={workspaceId}
          providers={availableProviders}
          onCancel={() => setDisclosureOpen(false)}
          onStarted={(started) => {
            setDisclosureOpen(false);
            setRun(started);
          }}
        />
      ) : null}
      {reviewPreview ? (
        <AgentProfileImportPreview
          preview={reviewPreview.preview}
          requireDisplayName
          onCancel={() => setReviewPreview(null)}
          onImported={() => {
            // confirmImport consumed the proposal on the main side. Reflect it
            // here rather than waiting for the next getRun.
            const accepted = reviewPreview.proposalId;
            setRun((current) =>
              current
                ? {
                    ...current,
                    proposals: current.proposals.filter((p) => p.proposalId !== accepted),
                  }
                : current,
            );
            setReviewPreview(null);
          }}
        />
      ) : null}
    </section>
  );
}
