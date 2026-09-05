import { useEffect, useId, useRef, useState } from 'react';
import type {
  ApprovedWorkspaceView,
  OperationResponse,
  ProviderId,
  ReadinessView,
} from '@threadhelm/contracts';
import { api, call } from '../../api.js';
import { errorCode } from '../../errors.js';
import { reasonLabel } from '../mission-focus/reason-labels.js';

type RepoIdea = OperationResponse<'missionComposer.proposeRepoIdeas'>['ideas'][number];

export interface RepoIdeaFields {
  objective: string;
  completionEvidence: string;
}

/**
 * The screen before step 1 of the guided composer (spec 2026-09-03 §2).
 * It is not a composer stage: it owns its own live region, never renumbers
 * the 4-step strip, and only ever hands two editable text fields to Outcome.
 */
export function RepoIdeaEntry({
  workspaces,
  readiness,
  onSkip,
  onPick,
  onGoToSettings,
}: {
  workspaces: ApprovedWorkspaceView[];
  readiness: ReadinessView[];
  onSkip(): void;
  onPick(fields: RepoIdeaFields): void;
  onGoToSettings(): void;
}) {
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [workspaceId, setWorkspaceId] = useState('');
  const [providerId, setProviderId] = useState<ProviderId | ''>('');
  const [ideas, setIdeas] = useState<RepoIdea[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const approved = workspaces.filter((w) => !w.revokedAt);
  const availableProviders = readiness.filter((r) => r.availability === 'available');

  useEffect(() => {
    heading.current?.focus();
  }, []);

  const generate = async () => {
    if (!workspaceId) return;
    setBusy(true);
    setFailure(null);
    setIdeas(null);
    // "Provider default" means the first provider that is actually ready here,
    // so a beginner with only one CLI installed never has to touch the picker.
    const chosen = providerId || availableProviders[0]?.providerId;
    try {
      const result = await call(
        api.missionComposer.proposeRepoIdeas({
          workspaceId,
          ...(chosen ? { providerId: chosen } : {}),
        }),
      );
      setIdeas(result.ideas);
    } catch (cause) {
      setFailure(reasonLabel(errorCode(cause)) ?? "Couldn't generate ideas right now.");
    } finally {
      setBusy(false);
    }
  };

  const skip = (
    <button type="button" onClick={onSkip}>
      Skip — I&rsquo;ll write my own
    </button>
  );

  if (approved.length === 0)
    return (
      <section className="repo-idea-entry" aria-labelledby={headingId}>
        <p className="visually-hidden" role="status" aria-live="polite" />
        <h1 id={headingId} tabIndex={-1} ref={heading}>
          Pick a repo to get mission ideas, or write your own.
        </h1>
        <div className="composer-notice">
          <p>
            No approved folder yet. Go to Settings and approve a folder, then come back to choose it
            here.
          </p>
          <button type="button" className="primary" onClick={onGoToSettings}>
            Go to Settings
          </button>
        </div>
        <div className="mission-action-row">{skip}</div>
      </section>
    );

  return (
    <section className="repo-idea-entry" aria-labelledby={headingId}>
      <p className="visually-hidden" role="status" aria-live="polite">
        {busy ? 'Generating ideas…' : (failure ?? (ideas ? 'Ideas ready.' : ''))}
      </p>
      <h1 id={headingId} tabIndex={-1} ref={heading}>
        Pick a repo to get mission ideas, or write your own.
      </h1>
      <p className="hint">
        ThreadHelm sends only the folder&rsquo;s file names, README, manifest and recent commit
        subjects to the provider. Nothing is confirmed until you review it on the Outcome step.
      </p>
      <label className="field">
        Repo
        <select value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)}>
          <option value="">Choose an approved folder</option>
          {approved.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.displayPath}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Provider and model
        <select
          value={providerId}
          onChange={(event) => setProviderId(event.target.value as ProviderId | '')}
        >
          <option value="">Provider default model · provider default effort</option>
          {availableProviders.map((provider) => (
            <option key={provider.providerId} value={provider.providerId}>
              {provider.displayName} · provider default model
            </option>
          ))}
        </select>
      </label>
      <div className="mission-action-row">
        {skip}
        <button
          type="button"
          className="primary"
          disabled={!workspaceId || busy}
          aria-describedby={!workspaceId ? `${headingId}-why` : undefined}
          onClick={() => void generate()}
        >
          {ideas ? 'Try different ideas' : 'Generate ideas'}
        </button>
      </div>
      {!workspaceId ? (
        <p className="hint" id={`${headingId}-why`}>
          Choose a repo to enable Generate ideas.
        </p>
      ) : null}
      {busy ? <p>Generating ideas…</p> : null}
      {failure ? <p className="notice">{failure}</p> : null}
      {ideas ? (
        <ul className="repo-idea-list" aria-label="Mission ideas">
          {ideas.map((idea, index) => (
            <li key={index} className="repo-idea-card">
              <h2>{idea.title}</h2>
              <p>{idea.rationale}</p>
              <button
                type="button"
                onClick={() =>
                  onPick({
                    objective: idea.proposedObjective,
                    completionEvidence: idea.proposedCompletionEvidence,
                  })
                }
              >
                Use this idea
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
