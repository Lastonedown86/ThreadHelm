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
