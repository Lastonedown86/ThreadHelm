# Guided Agent Library Implementation Plan

**Decision:** Guided starter library as the Agents destination; Profile Studio appears when a local
profile is opened. Private profiles remain separate from bundled generic starters.

**Production files**

- Create `apps/desktop/src/renderer/features/coordination/AgentLibraryWorkspace.tsx`.
- Create `apps/desktop/src/renderer/features/coordination/AgentStarterLibrary.tsx`.
- Create `apps/desktop/src/renderer/styles/agent-library.css` and import it from `styles.css`.
- Modify `AgentProfileList.tsx`, `AgentProfileDetail.tsx`, `AgentTemplateLibrary.tsx`,
  `AgentProfileWizard.tsx`, `AppNavigation.tsx`, and `App.tsx`.
- Test `tests/e2e/agent-profile-wizard.spec.ts`, `tests/contract/agent-profiles.test.ts`,
  `tests/contract/agent-templates.test.ts`, `tests/acceptance/agent-profile-manifests.test.ts`, and
  `tests/e2e/accessibility.spec.ts`.

## Sequence

1. Add failing journeys for choosing a generic starter, resuming a draft, opening Profile Studio,
   and reviewing an imported JSON profile with filename, digest, goal, abilities, provider request,
   compatibility, and exact revision.
2. Compose existing template, draft, profile, and wizard operations behind one guided destination.
   Do not change manifest schema or make templates executable.
3. Keep bundled starters and private local profiles in separately labelled regions. Do not import
   test-fixture barrels or ship private personas.
4. Preserve native file selection, exact-field import confirmation, provenance, revision history,
   enable/disable, deletion disclosure, and storage-degraded blocking.
5. Run focused agent tests, production import/content scans, accessibility, lint, and typecheck.
