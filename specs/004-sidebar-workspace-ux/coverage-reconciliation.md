# Slice 32: functional coverage reconciliation

Product baseline: `7136e8a`; current base `9e82284` carries the helper-only CI follow-up. Dependent on PR #63. Remote main remains `8b9d549`; PRs #58-63 await owner merge. This reconciles every original A01-A08 matrix row and action inventory. Historical reports stay unchanged.

The [machine-readable ledger](coverage-ledger.json) retains every original cell, its evidence note and explicit current disposition. **Sampled evidence does not close a whole state matrix.** A passing generic suite, source trace or fixture screenshot does not establish unexercised outcomes. No real external provider execution is included.

## Current flow evidence and remaining coverage

### A01

Full context focus containment and badge lifecycle permutations remain pending; generic navigation passes do not establish them.

| Original flow              | Current scenario evidence                                                                                                                                                                                                        | Disposition                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Six destination buttons    | [mission-navigation](../../tests/e2e/mission-navigation.spec.ts)                                                                                                                                                                 | Observed scenarios only; remaining cell variants pending |
| New mission / Resume draft | [mission-navigation](../../tests/e2e/mission-navigation.spec.ts), [mission-draft-management](../../tests/e2e/mission-draft-management.spec.ts)                                                                                   | Observed scenarios only; remaining cell variants pending |
| Mission rows / selection   | [mission-selection-loading](../../tests/e2e/mission-selection-loading.spec.ts), [mission-focus-workspace](../../tests/e2e/mission-focus-workspace.spec.ts), [session-tab-identity](../../tests/e2e/session-tab-identity.spec.ts) | Observed scenarios only; remaining cell variants pending |
| Draft group / disclosure   | [mission-draft-management](../../tests/e2e/mission-draft-management.spec.ts)                                                                                                                                                     | Observed scenarios only; remaining cell variants pending |
| Context / attention toggle | [mission-focus-workspace](../../tests/e2e/mission-focus-workspace.spec.ts), [attention-accessibility](../../tests/e2e/attention-accessibility.spec.ts)                                                                           | Observed scenarios only; remaining cell variants pending |
| Notice / Dismiss           | [mission-navigation](../../tests/e2e/mission-navigation.spec.ts)                                                                                                                                                                 | Observed scenarios only; remaining cell variants pending |
| Unread / Attention badges  | [multi-session](../../tests/e2e/multi-session.spec.ts), [attention-scope](../../tests/e2e/attention-scope.spec.ts)                                                                                                               | Observed scenarios only; remaining cell variants pending |

### A02

All provider/permission combinations, every custom-runtime conflict choice and every review/dialog state at 200% remain pending. Existing/new runtime, exact save conflicts and main rejection paths have bounded evidence.

| Original flow                                           | Current scenario evidence                                                                                                                                                                                                          | Disposition                                              |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Repo entry / generation / pick                          | [repo-idea-context](../../tests/e2e/repo-idea-context.spec.ts), [repo-idea-generation](../../tests/e2e/repo-idea-generation.spec.ts)                                                                                               | Observed scenarios only; remaining cell variants pending |
| Outcome / exclusions                                    | [mission-flow-hierarchy](../../tests/e2e/mission-flow-hierarchy.spec.ts), [mission-keyboard-repair](../../tests/e2e/mission-keyboard-repair.spec.ts)                                                                               | Observed scenarios only; remaining cell variants pending |
| Crew / profile / session / role / assignment / evidence | [mission-composer](../../tests/e2e/mission-composer.spec.ts), [mission-existing-runtime](../../tests/e2e/mission-existing-runtime.spec.ts)                                                                                         | Observed scenarios only; remaining cell variants pending |
| Runtime / permission / autostart                        | [mission-runtime-consistency](../../tests/e2e/mission-runtime-consistency.spec.ts), [mission-existing-runtime](../../tests/e2e/mission-existing-runtime.spec.ts), [supervisor-mission](../../tests/e2e/supervisor-mission.spec.ts) | Observed scenarios only; remaining cell variants pending |
| Access / folder / mode / limits                         | [mission-folder-access](../../tests/e2e/mission-folder-access.spec.ts), [mission-keyboard-repair](../../tests/e2e/mission-keyboard-repair.spec.ts)                                                                                 | Observed scenarios only; remaining cell variants pending |
| Review / confirmation / expiry / revision               | [mission-composer](../../tests/e2e/mission-composer.spec.ts), [supervisor-mission](../../tests/e2e/supervisor-mission.spec.ts)                                                                                                     | Observed scenarios only; remaining cell variants pending |
| Close / Back / stage jump / save                        | [mission-flow-hierarchy](../../tests/e2e/mission-flow-hierarchy.spec.ts), [mission-navigation](../../tests/e2e/mission-navigation.spec.ts)                                                                                         | Observed scenarios only; remaining cell variants pending |
| Draft conflict / retry / discard                        | [mission-draft-management](../../tests/e2e/mission-draft-management.spec.ts), [mission-navigation](../../tests/e2e/mission-navigation.spec.ts), [mission-keyboard-repair](../../tests/e2e/mission-keyboard-repair.spec.ts)         | Observed scenarios only; remaining cell variants pending |
| Workspace / course / result / terminal links            | [mission-selection-loading](../../tests/e2e/mission-selection-loading.spec.ts), [mission-focus-workspace](../../tests/e2e/mission-focus-workspace.spec.ts)                                                                         | Observed scenarios only; remaining cell variants pending |
| Pause / resume / revision                               | [supervisor-mission](../../tests/e2e/supervisor-mission.spec.ts)                                                                                                                                                                   | Observed scenarios only; remaining cell variants pending |
| Cancel / Keep / delete content                          | [supervisor-mission](../../tests/e2e/supervisor-mission.spec.ts)                                                                                                                                                                   | Observed scenarios only; remaining cell variants pending |
| Held / unknown work resolution                          | [supervisor-mission](../../tests/e2e/supervisor-mission.spec.ts)                                                                                                                                                                   | Observed scenarios only; remaining cell variants pending |

### A03

Complete terminal input/stream fault matrix, native window-close gesture and all conversation asynchronous/retarget choices remain pending. No automatic replay is inferred safe.

| Original flow                                                  | Current scenario evidence                                                                                                                                                                        | Disposition                                              |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| Sessions destination and mission filter                        | [session-scope](../../tests/e2e/session-scope.spec.ts)                                                                                                                                           | Observed scenarios only; remaining cell variants pending |
| Local folder/provider/launch entry                             | [launch-session](../../tests/e2e/launch-session.spec.ts), [workspace-approval-pending](../../tests/e2e/workspace-approval-pending.spec.ts)                                                       | Observed scenarios only; remaining cell variants pending |
| Model/effort/work type/permission/limits                       | [launch-review-recovery](../../tests/e2e/launch-review-recovery.spec.ts)                                                                                                                         | Observed scenarios only; remaining cell variants pending |
| Session list and tabs                                          | [ended-session-inventory](../../tests/e2e/ended-session-inventory.spec.ts), [session-tab-identity](../../tests/e2e/session-tab-identity.spec.ts)                                                 | Observed scenarios only; remaining cell variants pending |
| Terminal stream/input/resize                                   | [multi-session](../../tests/e2e/multi-session.spec.ts), [terminal-visibility](../../tests/e2e/terminal-visibility.spec.ts), [session-tab-identity](../../tests/e2e/session-tab-identity.spec.ts) | Observed scenarios only; remaining cell variants pending |
| Interrupt/Stop/Force stop                                      | [stop-control](../../tests/e2e/stop-control.spec.ts)                                                                                                                                             | Observed scenarios only; remaining cell variants pending |
| Close-blocked flow                                             | [stop-control](../../tests/e2e/stop-control.spec.ts)                                                                                                                                             | Observed scenarios only; remaining cell variants pending |
| Recovery evidence/Dismiss/Start new                            | [recovery](../../tests/e2e/recovery.spec.ts), [recovery-selection](../../tests/e2e/recovery-selection.spec.ts)                                                                                   | Observed scenarios only; remaining cell variants pending |
| Handoff create/review/present/retarget/cancel                  | [coordination](../../tests/e2e/coordination.spec.ts)                                                                                                                                             | Observed scenarios only; remaining cell variants pending |
| Conversation filter/detail/auto-continue/pause/delete/escalate | [coordination](../../tests/e2e/coordination.spec.ts)                                                                                                                                             | Observed scenarios only; remaining cell variants pending |

### A04

Complete malformed-import and pending wizard-save/failure/repeated-action matrix remains pending. Exact roster selection/paging and normal authoring/restart are covered by named tests.

| Original flow                                    | Current scenario evidence                                                                                                        | Disposition                                              |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Agents entry and hierarchy                       | [agents-reflow](../../tests/e2e/agents-reflow.spec.ts)                                                                           | Observed scenarios only; remaining cell variants pending |
| Roster/filter/selection                          | [agent-roster-navigation](../../tests/e2e/agent-roster-navigation.spec.ts)                                                       | Observed scenarios only; remaining cell variants pending |
| Profile import and review                        | [agent-roster](../../tests/e2e/agent-roster.spec.ts), [agent-roster-navigation](../../tests/e2e/agent-roster-navigation.spec.ts) | Observed scenarios only; remaining cell variants pending |
| Detail and history                               | [agent-roster](../../tests/e2e/agent-roster.spec.ts)                                                                             | Observed scenarios only; remaining cell variants pending |
| Wizard source/identity/goal/capabilities/runtime | [agent-profile-wizard](../../tests/e2e/agent-profile-wizard.spec.ts)                                                             | Observed scenarios only; remaining cell variants pending |
| Review/refresh/save profile                      | [agent-profile-wizard](../../tests/e2e/agent-profile-wizard.spec.ts)                                                             | Observed scenarios only; remaining cell variants pending |
| Export/overwrite/cancel                          | [agent-profile-wizard](../../tests/e2e/agent-profile-wizard.spec.ts)                                                             | Observed scenarios only; remaining cell variants pending |
| Large roster                                     | [agent-roster-navigation](../../tests/e2e/agent-roster-navigation.spec.ts)                                                       | Observed scenarios only; remaining cell variants pending |

### A05

Conflicting template-revision and delayed wizard-save failure matrix remains pending. Paging failure, duplicate invalid-key/collision and restart receive new targeted coverage in slice 32.

| Original flow                 | Current scenario evidence                                                                                                                    | Disposition                                              |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Generic and local library     | [agent-profile-wizard](../../tests/e2e/agent-profile-wizard.spec.ts)                                                                         | Observed scenarios only; remaining cell variants pending |
| Template Details/close        | [agent-profile-wizard](../../tests/e2e/agent-profile-wizard.spec.ts)                                                                         | Observed scenarios only; remaining cell variants pending |
| Use template/source selection | [agent-profile-wizard](../../tests/e2e/agent-profile-wizard.spec.ts)                                                                         | Observed scenarios only; remaining cell variants pending |
| Duplicate/confirm/cancel      | [agent-profile-wizard](../../tests/e2e/agent-profile-wizard.spec.ts), [audit-template-matrix](../../tests/e2e/audit-template-matrix.spec.ts) | Observed scenarios only; remaining cell variants pending |
| Enable/Disable                | [agent-profile-wizard](../../tests/e2e/agent-profile-wizard.spec.ts)                                                                         | Observed scenarios only; remaining cell variants pending |
| Delete preview/confirm/keep   | [template-delete-recovery](../../tests/e2e/template-delete-recovery.spec.ts)                                                                 | Observed scenarios only; remaining cell variants pending |
| Draft resume/close/delete     | [agent-draft-identity](../../tests/e2e/agent-draft-identity.spec.ts), [agent-profile-wizard](../../tests/e2e/agent-profile-wizard.spec.ts)   | Observed scenarios only; remaining cell variants pending |
| Save as template/new revision | [agent-profile-wizard](../../tests/e2e/agent-profile-wizard.spec.ts)                                                                         | Observed scenarios only; remaining cell variants pending |
| Load more templates           | [audit-template-matrix](../../tests/e2e/audit-template-matrix.spec.ts)                                                                       | Observed scenarios only; remaining cell variants pending |

### A06

Publish Back/cancel/interrupted-write, retract/delete failure recovery and every modal focus/scale combination remain pending. Supersession late review and rejected append have targeted evidence.

| Original flow               | Current scenario evidence                                                                                                                      | Disposition                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Librarian and scoped search | [memory-search-scope](../../tests/e2e/memory-search-scope.spec.ts)                                                                             | Observed scenarios only; remaining cell variants pending |
| Results, paging, detail     | [memory-paging-selection](../../tests/e2e/memory-paging-selection.spec.ts), [memory-search-scope](../../tests/e2e/memory-search-scope.spec.ts) | Observed scenarios only; remaining cell variants pending |
| Publish and exact review    | [hive-memory](../../tests/e2e/hive-memory.spec.ts)                                                                                             | Observed scenarios only; remaining cell variants pending |
| Supersede and lineage       | [memory-review](../../tests/e2e/memory-review.spec.ts), [hive-memory](../../tests/e2e/hive-memory.spec.ts)                                     | Observed scenarios only; remaining cell variants pending |
| Retract and delete          | [hive-memory](../../tests/e2e/hive-memory.spec.ts), [memory-reading-list](../../tests/e2e/memory-reading-list.spec.ts)                         | Observed scenarios only; remaining cell variants pending |
| Conflicts and expiry        | [hive-memory](../../tests/e2e/hive-memory.spec.ts)                                                                                             | Observed scenarios only; remaining cell variants pending |
| Reading list and return     | [memory-reading-list](../../tests/e2e/memory-reading-list.spec.ts)                                                                             | Observed scenarios only; remaining cell variants pending |

### A07

All coach classifications and replacement launch with every missing-provider/revoked-folder combination remain pending. Recovery dismissal and exact mission-return scopes have targeted evidence.

| Original flow                          | Current scenario evidence                                                                                                                    | Disposition                                              |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Global Attention and counts            | [attention-scope](../../tests/e2e/attention-scope.spec.ts)                                                                                   | Observed scenarios only; remaining cell variants pending |
| Queue selection and exact detail       | [recovery-selection](../../tests/e2e/recovery-selection.spec.ts)                                                                             | Observed scenarios only; remaining cell variants pending |
| Row/detail Dismiss                     | [attention-accessibility](../../tests/e2e/attention-accessibility.spec.ts), [recovery-selection](../../tests/e2e/recovery-selection.spec.ts) | Observed scenarios only; remaining cell variants pending |
| Start new session and launch review    | [recovery](../../tests/e2e/recovery.spec.ts), [launch-review-recovery](../../tests/e2e/launch-review-recovery.spec.ts)                       | Observed scenarios only; remaining cell variants pending |
| Coach and retained evidence            | [recovery](../../tests/e2e/recovery.spec.ts)                                                                                                 | Observed scenarios only; remaining cell variants pending |
| Embedded Sessions, ended toggle        | [ended-session-inventory](../../tests/e2e/ended-session-inventory.spec.ts)                                                                   | Observed scenarios only; remaining cell variants pending |
| Mission decision versus recovery queue | [attention-scope](../../tests/e2e/attention-scope.spec.ts), [mission-focus-workspace](../../tests/e2e/mission-focus-workspace.spec.ts)       | Observed scenarios only; remaining cell variants pending |
| Setup summary/global notice            | [provider-readiness-recheck](../../tests/e2e/provider-readiness-recheck.spec.ts)                                                             | Observed scenarios only; remaining cell variants pending |

### A08

Recon provider changes during pending disclosure, every expiry/cancellation boundary and interrupted collection permutations remain pending. Folder approval and roster/readiness read recovery have targeted evidence.

| Original flow                              | Current scenario evidence                                                                                                                                  | Disposition                                              |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Choose/approve folder                      | [workspace-approval-pending](../../tests/e2e/workspace-approval-pending.spec.ts)                                                                           | Observed scenarios only; remaining cell variants pending |
| Revoke approval                            | [launch-session](../../tests/e2e/launch-session.spec.ts)                                                                                                   | Observed scenarios only; remaining cell variants pending |
| Provider readiness/launch                  | [provider-readiness-recheck](../../tests/e2e/provider-readiness-recheck.spec.ts), [launch-review-recovery](../../tests/e2e/launch-review-recovery.spec.ts) | Observed scenarios only; remaining cell variants pending |
| Recon disclosure/start/stop                | [workspace-recon](../../tests/e2e/workspace-recon.spec.ts), [roster-read-recovery](../../tests/e2e/roster-read-recovery.spec.ts)                           | Observed scenarios only; remaining cell variants pending |
| Proposed roles/review/import               | [recon-proposal-lifetime](../../tests/e2e/recon-proposal-lifetime.spec.ts)                                                                                 | Observed scenarios only; remaining cell variants pending |
| Application health/effective configuration | [smoke](../../tests/e2e/smoke.spec.ts)                                                                                                                     | Observed scenarios only; remaining cell variants pending |
| Mission prerequisite return                | [mission-runtime-consistency](../../tests/e2e/mission-runtime-consistency.spec.ts), [mission-navigation](../../tests/e2e/mission-navigation.spec.ts)       | Observed scenarios only; remaining cell variants pending |

## Reconciliation result

The ledger contains 68 flows, 476 state cells and 120 action traces. Each cell has a retained observation, evidence association and a pending or justified N/A disposition. This is a complete inventory reconciliation, **not an exhaustive functional acceptance pass**.

All accepted finding fixes through slice 31 have bounded verification in [verification.md](verification.md). Slice 32 adds template paging/duplicate negative coverage. Remaining state permutations above require targeted verification or an explicit owner-approved disposition before an unqualified feature-complete claim. Slice 33 separately measures cross-section keyboard/text-scale and Windows responsiveness and presents acceptance limits.

## Regression results

- Electron: 121 passed, 1 skipped (opt-in parity screenshots), 12.1 minutes. New template matrix case separately passed (4.6 seconds).
- Unit: 495 passed. Contract: 307 passed.
- Windows integration: 102 passed, 1 skipped, 373.75 seconds. The skipped startup read-only/locked-database case requires a file lock the harness cannot retain across Electron startup; it remains unverified.
- Named scenario associations cover portions of 267 state cells; 192 cells have no current cell-specific closure; 17 cells have justified N/A dispositions. Even associated cells retain pending variants. Counts are inventory dispositions, not a test pass percentage.
- Hosted CI: PRs #58-60 green. PR #61 ARM64 failed during keyboard New mission entry before selection assertions; helper synchronization follow-up `b361e82` passed 10 local repetitions (58.5 seconds) and was propagated through #62/#63. Fresh hosted checks are pending. Later PR CI and owner merges remain separate.

The template test seeds 22 local copies, pages through actual UI, injects a page-read failure, verifies selected detail survives, retries, rejects invalid/colliding keys, cancels and compares exact inventory IDs through restart. Its initial harness request exceeded the contract page limit; corrected to the real maximum of 50 before the passing run. No product change or real provider execution.
