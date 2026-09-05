# Slice 1 validation

Run in the existing Windows checkout with installed locked dependencies and isolated test user data.

```powershell
pnpm exec vitest run --project unit tests/unit/renderer/draft-save-queue.test.ts tests/unit/renderer/navigation.test.ts
pnpm desktop:build
pnpm exec playwright test tests/e2e/mission-navigation.spec.ts tests/e2e/mission-composer.spec.ts tests/e2e/mission-focus-workspace.spec.ts tests/e2e/accessibility.spec.ts
pnpm typecheck
pnpm lint
```

Expected: all six destinations route global entry/resume correctly; edits survive immediate navigation and authoritative readback/restart; failed save keeps editor and target unchanged, retry/escape/explicit leave work; selecting a mission replaces the composer. Unit tests hold a save response, edit again, and ensure the flush waits for the second sequential save. Existing composer/lifecycle accessibility tests remain green.

No real external providers. Preserve the pre-fix audit JSON; record post-fix evidence separately in `verification.md`. Run formatting on changed implementation files and check documentation formatting through the Prettier API because specs are ignored by the repository CLI formatter.

## Verify SES-001

Run `pnpm desktop:build`, then `pnpm exec playwright test tests/e2e/session-scope.spec.ts tests/e2e/mission-focus-workspace.spec.ts tests/e2e/mission-navigation.spec.ts`. The fixtures use isolated local sessions. Confirm the scope selector, an unrelated Settings launch landing on its own exact session, Attention return, repeated global Sessions reset, and mission Open terminal. Test assertions compare authoritative live session IDs and PIDs before and after navigation. Baseline A03 captures remain pre-fix observations; do not replace them with these regression results.

## Verify AGT-001/002

Build with `pnpm desktop:build`; run `pnpm exec playwright test tests/e2e/agent-roster-navigation.spec.ts tests/e2e/agent-roster.spec.ts tests/e2e/agent-profile-wizard.spec.ts`. The navigation spec seeds 51 generic profiles through main contracts, then exercises real UI pagination, exact eligibility changes, selection and filter-empty behavior. Readback verifies the exact saved profile state and no process launch. Original A04/A05 probes remain pre-fix observations and are not acceptance tests for the changed UI.
