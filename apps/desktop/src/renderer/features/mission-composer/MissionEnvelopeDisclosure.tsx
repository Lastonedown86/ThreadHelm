import type { MissionBounds, MissionPreviewView } from '@threadhelm/contracts';
import { BOUND_LABELS } from './composer-fields.js';

export function MissionEnvelopeDisclosure({ preview }: { preview: MissionPreviewView }) {
  return (
    <section aria-label="Exact mission envelope">
      <h3 tabIndex={-1}>Review mission authority</h3>
      <p>{preview.envelope.objective}</p>
      <p>Completion evidence: {preview.envelope.completionEvidence}</p>
      {preview.envelope.exclusions.length ? (
        <p>Outside this mission: {preview.envelope.exclusions.join('; ')}</p>
      ) : null}
      <p className="notice">{preview.boundaryWarning}</p>
      <dl>
        {Object.entries(preview.envelope.bounds).map(([key, value]) => (
          <div key={key}>
            <dt>{BOUND_LABELS[key as keyof MissionBounds]}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p>
        Routine actions: {preview.envelope.permittedRoutineActions.join(', ')}. Retry requires
        proved failure before effect.
      </p>
      <p>
        Consequential actions, unknown outcomes, exhausted bounds, and supervisor loss stop work.
        Profiles and model output cannot expand this envelope.
      </p>
      <p>
        No substitution or bypass is authorized. Unknown actions are never replayed automatically.
      </p>
      {preview.envelope.bindings.map((binding) => (
        <fieldset key={binding.bindingId}>
          <legend>
            {binding.role} · {binding.bindingId.slice(0, 8)} · {binding.launchDisposition}
          </legend>
          <p>
            Profile {binding.profileId} / revision {binding.profileRevisionId}
          </p>
          <p className="mono">Digest: {binding.profileDigest}</p>
          <p>
            {binding.displayPath} · {binding.mode} · session {binding.sessionId ?? 'offline'}
          </p>
          <p>
            Automatic startup:{' '}
            {binding.autoStart ? 'authorized for this exact binding' : 'not authorized'}
          </p>
          {binding.assignment ? <p>Assignment: {binding.assignment}</p> : null}
          {binding.requiredReturnEvidence.length ? (
            <p>Must bring back: {binding.requiredReturnEvidence.join('; ')}</p>
          ) : null}
          <p>
            {binding.providerId} {binding.readiness.version} · model{' '}
            {binding.runtimeSelection.model ?? 'CLI default'} · effort{' '}
            {binding.runtimeSelection.effort ?? 'CLI default'}
          </p>
          <p>
            Permission: {binding.permissionResolution.policy} · source{' '}
            {binding.permissionResolution.source} · {binding.permissionResolution.disposition}
          </p>
          <p>
            Isolation requested: {String(binding.requestedIsolation)}; effective:{' '}
            {String(binding.effectiveIsolation)}. Effective token ceiling:{' '}
            {binding.effectiveTokenBudget}.
          </p>
          <pre aria-label={`Exact launch and permission binding ${binding.bindingId}`}>
            {JSON.stringify(
              {
                providerMapping: binding.permissionResolution.providerMapping,
                permissionSelection: binding.permissionSelection,
                boundedAllowlist: binding.permissionResolution.boundedAllowlist,
                capabilityEvidence: binding.permissionResolution.capabilityEvidence,
                runtimeResolution: binding.runtimeResolution,
                bounds: binding.executionBounds,
                identity: binding.identity,
              },
              null,
              2,
            )}
          </pre>
          {binding.reasonCode ? (
            <p className="notice">
              Held: {binding.reasonCode}. No substitution or bypass is authorized.
            </p>
          ) : null}
        </fieldset>
      ))}
      <p>Review expires: {preview.expiresAt}</p>
    </section>
  );
}
