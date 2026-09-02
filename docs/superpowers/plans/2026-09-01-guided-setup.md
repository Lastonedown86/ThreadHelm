# Guided Local Setup Implementation Plan

**Decision:** Three task-oriented checks for workspace approval, provider readiness, and application
health; mission context may show a read-only attention summary.

**Production files**

- Create `apps/desktop/src/renderer/features/workspaces/GuidedSetup.tsx`.
- Create `apps/desktop/src/renderer/features/workspaces/ApplicationEvidence.tsx`.
- Create `apps/desktop/src/renderer/features/workspaces/SetupAttentionSummary.tsx`.
- Create `apps/desktop/src/renderer/styles/guided-setup.css` and import it from `styles.css`.
- Modify `WorkspacePanel.tsx`, `ProviderReadiness.tsx`, `App.tsx`, and `MissionContext.tsx`.
- Test `tests/contract/desktop-ipc-workspaces.test.ts`,
  `tests/integration/windows/workspace-identity.test.ts`,
  `tests/acceptance/provider-smoke.test.ts`, `tests/e2e/launch-session.spec.ts`, and
  `tests/e2e/accessibility.spec.ts`.

## Sequence

1. Add failing UI coverage for no workspace, approved effective identity, reparse warning,
   revocation, available/missing/unsupported/unauthenticated/error providers, healthy/degraded
   storage, and application evidence.
2. Compose existing native selection, approval, revocation, readiness, and app-info contracts into
   three checks. Do not replace native selection or add provider authentication inside ThreadHelm.
3. Show provider before model and derive effort choices only after provider/model selection. Preserve
   CLI default and Custom model without silent substitution.
4. Keep live controls available during degraded storage while blocking launches and durable changes.
   Report Windows x64 and intentional unsigned status as evidence, not warnings to bypass.
5. Run focused workspace/provider tests, accessibility, lint, typecheck, and desktop build.
