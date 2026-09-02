# Session Workspace Implementation Plan

**Decision:** Mission-scoped terminal dock with session tabs; lifecycle inspector opens only for
failed and recovery-required sessions.

**Production files**

- Create `apps/desktop/src/renderer/features/sessions/SessionWorkspace.tsx`.
- Create `apps/desktop/src/renderer/features/session/MissionTerminalDock.tsx`.
- Create `apps/desktop/src/renderer/styles/session-workspace.css` and import it from `styles.css`.
- Modify `apps/desktop/src/renderer/App.tsx`, `SessionList.tsx`, `LazyTerminal.tsx`, and
  `ControlBar.tsx` only to compose existing state and controls into the approved structure.
- Test `tests/e2e/multi-session.spec.ts`, `tests/e2e/mission-focus-workspace.spec.ts`,
  `tests/e2e/accessibility.spec.ts`, and `tests/contract/session-stream.test.ts`.

## Sequence

1. Add failing E2E coverage for exact mission/session identity, tab switching, new output, stopped,
   failed, recovery-required, truncation, backpressure, and wrong-selection input rejection.
2. Mount the dock only for the selected mission and bind terminal, controls, and tab identity in one
   component boundary. Collapsing changes presentation only and never stops a session.
3. Preserve F6 terminal escape, bounded stream behavior, existing stop disclosures, and input-owner
   rejection. Do not move process control into renderer code.
4. Add the on-demand lifecycle inspector and verify unknown outcomes never offer automatic retry.
5. Run focused E2E, session-stream contract, accessibility, lint, and typecheck before acceptance.
