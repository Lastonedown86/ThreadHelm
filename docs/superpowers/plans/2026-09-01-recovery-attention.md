# Recovery Attention Queue Implementation Plan

**Decision:** Cross-mission attention queue with mission-context detail. Destructive actions use an
exact-scope review and remain separate from recovery resolution.

**Production files**

- Create `apps/desktop/src/renderer/features/recovery/RecoveryAttentionQueue.tsx`.
- Create `apps/desktop/src/renderer/features/recovery/RecoveryDetail.tsx`.
- Create `apps/desktop/src/renderer/features/recovery/RecoveryCoach.tsx`.
- Create `apps/desktop/src/renderer/features/control/ContentDeletionReview.tsx`.
- Create `apps/desktop/src/renderer/styles/recovery-attention.css` and import it from `styles.css`.
- Modify `RecoveryPanel.tsx`, `MissionDetail.tsx`, `MissionContext.tsx`, and `App.tsx`.
- Test `tests/e2e/recovery.spec.ts`, `tests/contract/desktop-ipc-recovery.test.ts`,
  `tests/unit/persistence/recovery.test.ts`, `tests/integration/windows/recovery.test.ts`,
  `tests/unit/coordination-recovery.test.ts`, and `tests/e2e/accessibility.spec.ts`.

## Sequence

1. Add failing journeys for every recovery classification, exact target identity, retained event
   evidence, dismissal, reviewed replacement, storage degradation, and content deletion scope.
2. Present all unresolved records in one queue. Opening a record binds mission, session, workspace,
   provider, last-known state, classification, and safe summary in one exact-target detail.
3. Preserve the rule that unknown work is never replayed, resumed, resent, or classified as success
   or failure. A replacement starts new reviewed work and may only supersede the recovery record.
4. Centralize destructive review presentation while retaining existing preview tokens and operation
   contracts. Name removed content, linked memory, retained content-free receipts, exclusions, and
   active/unknown blockers before confirmation.
5. Run focused recovery tests, unknown-effect regression coverage, accessibility, lint, typecheck,
   and desktop build.
