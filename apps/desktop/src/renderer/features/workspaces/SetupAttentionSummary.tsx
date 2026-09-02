import { useStore } from '../../store.js';

export function SetupAttentionSummary() {
  const { state } = useStore();
  const approved = state.workspaces.filter((workspace) => workspace.revokedAt === null).length;
  const available = state.readiness.filter(
    (provider) => provider.availability === 'available',
  ).length;
  const issues = [
    approved === 0 ? 'Approve a workspace' : null,
    available === 0 ? 'No provider is ready' : null,
    state.storageDegraded ? 'Storage needs attention' : null,
  ].filter((item): item is string => item !== null);

  return (
    <section className="setup-attention" aria-label="Setup attention">
      <span className="context-label">Local setup</span>
      <strong>
        {issues.length === 0
          ? 'Ready for reviewed work'
          : `${issues.length} item${issues.length === 1 ? '' : 's'} need attention`}
      </strong>
      {issues.length > 0 ? (
        <ul>
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
