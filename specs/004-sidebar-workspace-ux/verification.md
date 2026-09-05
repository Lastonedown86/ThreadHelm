# Slice 1 verification — edit preservation and navigation

Date: 2026-09-05. Branch: `codex/audit-sidebar-mission-functionality`. Base: `efcd523f898f8353ad1975614f1953b94a5656d4`. Windows 11 Home x64, OS release 10.0.26200. Scope: accepted MIS-001/002, not all of Feature 004.

## Behavior and evidence

Five corrected regression cases failed against the pre-fix build for their expected reasons: global resume stayed on another destination; immediate New mission lost typed objective; failed navigation showed no decision; draft replacement lost identity/values; mission selection left the composer visible. Initial test-authoring selector mistakes were corrected before this baseline run and are not counted as product failures.

All six new Electron tests now pass. They drive visible controls and independently call the normal main-process contracts to inspect exact draft fields and mission IDs. Normal save and explicit unsaved exit include app restart readback. No external provider runs: mission targeting uses two isolated echo fixtures, and navigation leaves their process count unchanged.

- Global New mission / Resume draft: six destinations, correct destination selected, saved identity retained.
- New mission before debounce: latest objective saved and retained after restart.
- Save failure: editor values retained; Escape/Keep editing retain the editor; both Agents and New mission are blocked; Retry remains blocked under a persistent storage failure; explicit Leave without saving navigates and restart restores only the previous saved value.
- Draft replacement: exact outgoing values stored under the outgoing ID; incoming draft has independent fields.
- Mission selection: composer replaced by correct mission, outgoing draft saved, mission remains running with exactly two existing fixture sessions.
- Conflict choices: stale save retains local text and prompts; Keep my edits persists local text after accepting the fresh version; Use saved version restores the chosen saved text and permits navigation without overwriting it.

Three save-queue unit tests cover shared in-flight draining, failure without internal retry and later explicit retry, and recovery after unexpected rejection. Four existing navigation unit tests also pass. This is deterministic queue-level concurrency proof, not a measured renderer/IPC latency stress test.

## Validation results

- Fresh `pnpm desktop:build`: PASS.
- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS.
- Focused Vitest: 2 files, 7 tests PASS.
- Existing composer, mission-focus-workspace, accessibility, repo-idea-generation and supervisor-mission specs: 32 tests PASS (2.5m).
- New mission-navigation spec: 6 tests PASS (21.2s).
- After final debounce-failure cleanup and load-error copy adjustment: fresh build and composer plus mission-navigation rerun, 15 tests PASS (1.0m).
- Changed-file formatting and local documentation links: PASS. Diff whitespace: PASS. Gitleaks scans of feature artifacts, renderer source and E2E tests: no leaks.
- Total distinct selected E2E scenarios: 38. Full test suite and hosted CI were not run.

The [failed-save dialog capture](audits/evidence/slice-1-save-failure.png) was captured in the isolated UI run and visually inspected. Keep editing receives initial focus; the background is inert through the reused native modal. Existing keyboard/reflow tests passed their samples. The new modal was observed at the standard test viewport; a complete viewport/accessibility matrix remains A01/A02 work.

## Scope and remaining work

No IPC contract, database schema, provider behavior or process-control rule changed. No new dependencies, idle polling or recurring rendering. Keep the original 800ms debounce and one active flush queue. Draft loading hides editable fields until hydration; draft IDs key separate component lifetimes. Failed exits retain the target until retry, cancellation or explicit unsaved leave.

Unsubmitted list-item input buffers, delayed mission-detail identity (MIS-013), all prerequisite round trips, large inventories, badges, draft management and other proposed findings remain open. Successful Close still uses its existing receipt (MIS-009 is separate). Real-provider/autostart capability gates and Feature 002/003 completion are unchanged. The shared selector still points to Feature 002; plan/task setup and prerequisite resolution used an isolated planning worktree.
