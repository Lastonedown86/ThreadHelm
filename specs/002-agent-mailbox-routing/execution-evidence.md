# Execution Evidence: Durable Hive Coordination

**Feature**: `specs/002-agent-mailbox-routing`

**Implementation started**: 2026-08-28

This ledger separates local commands, hosted CI, installed-artifact proof, live-provider proof,
independent model review, human approval, and release readiness. A later pass never erases an earlier
failure, and a model statement is not executable evidence.

## Baseline

| Item | Evidence |
|---|---|
| Active feature pointer | `.specify/feature.json` resolves to `specs/002-agent-mailbox-routing`. |
| Branch | `main` |
| Commit | `a0a32e64eb62bf25a722fcffc1fe506b43c4a434` |
| Remote | `origin https://github.com/Lastonedown86/ThreadHelm.git` |
| Unrelated tracked changes | `apps/desktop/src/session-host/index.ts`, `apps/desktop/src/session-host/resize.ts` — preserve and do not edit for this feature. |
| Unrelated untracked changes | `tests/unit/session-host/` — preserve and do not edit for this feature. |
| Node.js | `v24.18.0` |
| pnpm | `11.0.8` |
| Rust | `rustc 1.98.0`, `cargo 1.98.0` |
| Codex CLI | `0.150.1` |
| Claude Code | `2.1.251` |
| Antigravity CLI | `1.1.22` |
| Ignore-file audit | Existing `.gitignore`, `.prettierignore`, and `eslint.config.js` cover Node, Rust, build, coverage, secret, editor, and tool output. Repository/packages are private; no `.npmignore` is required. No Docker, Terraform, or Helm surface was detected. |

## Story model and review gates

Record live availability immediately before each story. `UNVERIFIED` means no ownership is assigned
yet; it is not a failure or permission to substitute another ecosystem.

| Story | Primary / effort | In-ecosystem fallback | Independent verifier | Availability | Review result |
|---|---|---|---|---|---|
| US1 Directed handoffs | OpenAI `gpt-5.6-sol` / `high` | `gpt-5.6-terra` / `xhigh` | Claude `claude-opus-5` / `high` | AUTH VERIFIED IN NORMAL CLI MODE 2026-08-29 | APPROVED FOR US1 MVP |
| US2 Auditable conversations | Antigravity `gemini-3.7-flash-medium` | `gemini-3.6-flash-medium` | Claude `claude-sonnet-5` / `high` | VERIFIED 2026-08-29 | APPROVED FOR US2 |
| US3 Lifecycle-aware delivery | Claude `claude-opus-5` / `high` | `claude-sonnet-5` / `xhigh` | OpenAI `gpt-5.6-sol` / `max` | VERIFIED 2026-08-29 | APPROVED FOR US3 |
| US4 Bounded coordination | OpenAI `gpt-5.6-sol` / `max` | `gpt-5.6-terra` / `max` | Claude `claude-opus-5` / `xhigh` + human | VERIFIED 2026-08-29 | PENDING IMPLEMENTATION/REVIEW/HUMAN ACCEPTANCE |
| US5 Shared hive memory | Antigravity `gemini-3.1-pro-high` | `gemini-3.7-flash-medium` | Claude `claude-opus-5` / `high` | VERIFIED 2026-08-29 | APPROVED FOR US5 |
| US6 Reviewed agent roster | Claude `claude-sonnet-5` / `high` | `claude-opus-5` / `high` | OpenAI `gpt-5.6-sol` / `high` | VERIFIED 2026-08-29 | IMPLEMENTATION PENDING |
| US7 Agent wizard/templates | OpenAI `gpt-5.6-terra` / `high` | `gpt-5.6-sol` / `high` | Deterministic schema/export tests; Claude `claude-sonnet-5` / `high` only after owner approval | OPENAI ASSIGNMENT PENDING CURRENT AVAILABILITY CHECK; CLAUDE/ANTIGRAVITY RUNS NOT AUTHORIZED | PENDING |
| US8 Autonomous supervisor | OpenAI `gpt-5.6-sol` / `max` | `gpt-5.6-terra` / `max` | Claude `claude-opus-5` / `xhigh` + human + Antigravity `gemini-3.1-pro-high` | UNVERIFIED | PENDING |

## Command evidence

| 2026-08-30 | US7 execution reassignment | Owner instruction recorded in the active Spec Kit artifacts | N/A | OpenAI `gpt-5.6-terra` / `high` is the US7 primary and `gpt-5.6-sol` / `high` its in-ecosystem fallback. Do not start, probe, or otherwise invoke Claude or Antigravity for US7 without first asking the owner; Claude remains an approval-gated independent verifier and Antigravity is unassigned for this cycle. No external provider run was started by this reassignment. | PENDING — OPENAI AVAILABILITY AND IMPLEMENTATION GATE |
| 2026-08-30 | T107 US7 local model gate | Current Codex desktop host model inventory | N/A | The current host exposes OpenAI `gpt-5.6-terra` at `high` and fallback `gpt-5.6-sol` at `high`. Terra owns the bounded local wizard/template implementation; deterministic schema/export tests remain the correctness gate. No Claude or Antigravity CLI, model probe, or provider run was invoked. | PASS — IMPLEMENTATION ASSIGNED |
| 2026-08-30 | T108/T113/T114 US7 domain and fixture foundation | `pnpm exec vitest run --project unit tests/unit/domain/agent-template.test.ts`; `pnpm typecheck` | 0 | The intended missing-domain red phases failed 4/4 and then 1/5, then passed 6/6 after adding copy-on-create provenance, literal declared-variable substitution, unresolved-variable rejection, strict shared-manifest validation/bounds, closed draft lifecycle transitions, and non-authoritative completion policy. Six versioned generic starters (investigator, implementer, reviewer, quality, documentation, release gate) are exported without Marvel or project content. | PASS — FOUNDATION ONLY |
| 2026-08-30 | T109/T115/T116 persistence foundation | `pnpm exec vitest run --project unit tests/unit/persistence/agent-templates.test.ts`; `pnpm typecheck` | 0 | The intended missing-repository red phase failed 2/2, then passed 2/2 after adding durable template, immutable revision, and draft tables plus a main-owned repository for bundled seeds, draft provenance, completion, and completed-draft edit denial. Remaining quota, revision lifecycle, and full recovery scenarios are still pending. | PASS — FOUNDATION ONLY |

| Timestamp | Scope | Command | Exit | Final summary | Status |
|---|---|---|---:|---|---|
| 2026-08-28 | Baseline | `pnpm typecheck` | 0 | TypeScript build completed. | PASS |
| 2026-08-28 | Baseline | `pnpm test:unit` | 0 | 12 files, 71 tests passed. | PASS |
| 2026-08-28 | Baseline | `pnpm test:contract` | 0 | 6 files, 118 tests passed. | PASS |
| 2026-08-28 | T002 fixture | `pnpm exec vitest run --project unit tests/unit/fixtures/coordination.test.ts` | 0 | 1 file, 1 test passed. | PASS |
| 2026-08-28 | T003 bridge scaffold | `cargo fmt --check`; `cargo check --bin threadhelm-coordination-bridge`; `cargo check --all-targets` | 0 | Inert binary and all Rust targets compiled. | PASS |
| 2026-08-28 | T004 Windows harness | `pnpm exec vitest run --project integration tests/integration/windows/helpers/coordination-harness.test.ts` | 0 | 1 file, 2 tests passed after the missing-helper red phase. | PASS |
| 2026-08-28 | T006 contract red | `pnpm exec vitest run --project contract tests/contract/desktop-ipc-coordination.test.ts` | 1 | 1 file, 6 intended missing-primitive failures. | EXPECTED RED |
| 2026-08-28 | T007 sanitizer red | `pnpm exec vitest run --project unit tests/unit/persistence/sanitize.test.ts` | 1 | 13 intended missing-sanitizer failures; 27 legacy tests still passed. | EXPECTED RED |
| 2026-08-28 | T008 contract green | `pnpm exec vitest run --project contract tests/contract/desktop-ipc-coordination.test.ts` | 0 | 1 file, 6 tests passed. | PASS |
| 2026-08-28 | T009 sanitizer green | `pnpm exec vitest run --project unit tests/unit/persistence/sanitize.test.ts` | 0 | 1 file, 40 tests passed. | PASS |
| 2026-08-28 | Foundation typecheck | `pnpm typecheck` | 1 | Exhaustive renderer error map identified all newly added coordination codes as missing. | FAIL — FIXED |
| 2026-08-28 | Foundation typecheck retry | `pnpm typecheck` | 0 | TypeScript build completed after adding safe user-facing coordination messages. | PASS |
| 2026-08-28 | T010 bridge fixtures | `pnpm exec vitest run --project unit tests/unit/fixtures/coordination.test.ts` | 0 | Deterministic bridge, lifecycle, memory, supervisor, and content-free event fixtures passed. | PASS |
| 2026-08-28 | T011–T013 foundation | `pnpm exec vitest run --project unit tests/unit/coordination-service.test.ts tests/unit/main/coordination-disclosures.test.ts tests/unit/fixtures/coordination.test.ts` | 0 | 3 files, 9 tests passed after the T013 two-failure red phase. | PASS |
| 2026-08-28 | Foundation unit suite | `pnpm test:unit` | 0 | 15 files, 93 tests passed. | PASS |
| 2026-08-28 | Foundation contract suite | `pnpm test:contract` | 0 | 7 files, 124 tests passed. | PASS |
| 2026-08-28 | T014 Claude availability | `claude --print --model claude-opus-5 --effort high ... --max-budget-usd 0.05` | 1 | Service resolved canonical `claude-opus-5`; the tiny probe hit the budget guard after reporting USD 0.392475, so no implementation/review work was assigned in that invocation. | AVAILABILITY VERIFIED; WORK NOT RUN |
| 2026-08-29 | T015 domain red | `pnpm vitest run --project unit tests/unit/domain/coordination.test.ts` | 1 | 9/9 intended failures for absent policy exports; escalation extension separately produced 1/10 intended failure. | EXPECTED RED |
| 2026-08-29 | T019 domain green | `pnpm exec vitest run --project unit tests/unit/domain/coordination.test.ts` | 0 | 1 file, 10 tests passed; domain package TypeScript build also passed. | PASS |
| 2026-08-29 | T016 persistence red | `pnpm exec vitest run --project unit tests/unit/persistence/coordination.test.ts` | 1 | Migration/repository seams failed as intended; two initial false positives were tightened before implementation. | EXPECTED RED |
| 2026-08-29 | T020–T021 persistence green | `pnpm exec vitest run --project unit tests/unit/persistence/coordination.test.ts` | 0 | 1 file, 8 tests passed across migration, indexes, atomic creation, quota, recovery, attempts, retarget, and cancel. | PASS |
| 2026-08-29 | T017 IPC contract red | `pnpm exec vitest run --project contract tests/contract/desktop-ipc-coordination.test.ts` | 1 | 5 intended failures for absent named handoff/disclosure schemas. | EXPECTED RED |
| 2026-08-29 | T017 IPC contract current | `pnpm exec vitest run --project contract tests/contract/desktop-ipc-coordination.test.ts` | 0 | 1 file, 12 tests passed after named strict schemas were added for downstream service work. | PASS |
| 2026-08-29 | T018 Windows delivery red | `pnpm exec vitest run tests/integration/windows/coordination-delivery.test.ts` | 1 | 6 intended failures at unregistered `coordination.previewHandoff`; no provider credentials used. | EXPECTED RED |
| 2026-08-29 | US1 core typecheck | `pnpm typecheck` | 0 | Contracts, domain, migration, repository, and existing worktree TypeScript build passed. | PASS |
| 2026-08-29 | T022–T025 main coordination | `pnpm exec vitest run --project unit tests/unit/domain/coordination.test.ts tests/unit/persistence/coordination.test.ts tests/unit/coordination-service.test.ts tests/unit/main/coordination-disclosures.test.ts tests/unit/coordination-recovery.test.ts` | 0 | 5 files, 33 tests passed. | PASS |
| 2026-08-29 | T026 strict IPC | `pnpm test:contract` | 0 | 7 files, 131 tests passed. | PASS |
| 2026-08-29 | T027–T030 renderer build | `pnpm desktop:build` | 0 | Main, preload, and renderer production bundles built. | PASS |
| 2026-08-29 | T018/T024 total-order expansion | `pnpm exec vitest run --project integration tests/integration/windows/coordination-delivery.test.ts` | 1 | The expanded interrupt-then-stop case correctly rejected `interrupting -> stopping`; the proof was changed to await the visible return-to-running acknowledgement before requesting stop. | FAIL — FIXED |
| 2026-08-29 | T018/T024 Windows delivery retry | `pnpm exec vitest run --project integration tests/integration/windows/coordination-delivery.test.ts` | 0 | 1 file, 6 tests passed, including handoff/input/resize/interrupt/stop order, duplicate, pre-write, ambiguous crash, and isolation. | PASS |
| 2026-08-29 | T030 E2E initial | `pnpm exec playwright test tests/e2e/coordination.spec.ts` | 1 | Retarget/cancel and duplicate/crash recovery passed; the presentation test sent ArrowDown before the Home selection rerendered. | FAIL — FIXED |
| 2026-08-29 | T030 E2E focused retry | `pnpm exec playwright test tests/e2e/coordination.spec.ts --grep "creates and manually presents"` | 0 | Keyboard selection now waits for visible state acknowledgement and refocuses before the next key. | PASS |
| 2026-08-29 | T030 E2E final | `pnpm exec playwright test tests/e2e/coordination.spec.ts` | 0 | 3 tests passed: keyboard create/present, keyboard retarget/cancel, and duplicate plus ambiguous restart recovery. | PASS |
| 2026-08-29 | Static gate initial | `pnpm typecheck; pnpm lint; prettier --check ...` | 1 | Typecheck passed; lint found two import-type style errors and formatting found two feature files. | FAIL — FIXED |
| 2026-08-29 | Static gate retry | `pnpm lint; pnpm typecheck` | 0 | Full ESLint and TypeScript build passed after type-only imports were made explicit. | PASS |
| 2026-08-29 | T031 Claude review | `claude --print --bare --model claude-opus-5 --effort high ...` | 1 | CLI stopped before inference with `Not logged in`; reported 0 input/output/cache tokens and USD 0. No Claude findings were produced and no retry was attempted. | BLOCKED — AUTH |
| 2026-08-29 | Broad unit gate initial | `pnpm test:unit` | 1 | 117/118 passed; the v1 migration table-list assertion had not been updated for the five schema-v2 coordination tables. | FAIL — FIXED |
| 2026-08-29 | Broad unit gate retry | `pnpm test:unit` | 0 | 18 files, 118 tests passed after correcting the exact schema-table expectation. | PASS |
| 2026-08-29 | Rust gates | `pnpm rust:fmt`; `pnpm rust:check`; `pnpm rust:test` | 0 | Rust format and clippy passed; 17 library tests and the inert bridge target passed. | PASS |
| 2026-08-29 | Provisional review remediation | `pnpm typecheck`; focused US1 unit and contract tests | 0 | Durable-before-submit ordering, content-free list summaries, current workspace identity, presentable state, and activity-token binding fixes passed 24 focused unit and 13 focused contract tests. | PASS |
| 2026-08-29 | Post-review Windows/E2E | `pnpm desktop:build`; coordination Windows integration; coordination E2E | 0 | Desktop rebuilt, 6 Windows delivery tests passed, and 3 E2E journeys passed. | PASS |
| 2026-08-29 | Post-review broad gates | `pnpm test:unit`; `pnpm test:contract`; scoped `prettier --check`; `git diff --check` | 0 | 18 unit files/120 tests and 7 contract files/131 tests passed; formatting and whitespace checks passed. | PASS |
| 2026-08-29 | Post-review static retry | `pnpm lint`; `pnpm typecheck`; `git diff --check` | 0 | Full lint and TypeScript build passed after body-free summary conversion avoided unused bindings. | PASS |
| 2026-08-29 | T031 authenticated Claude retry | Normal-mode `claude --print --model claude-opus-5 --effort high ... --max-budget-usd 1.00` | 1 | Authentication succeeded and Opus inspected the repository for six turns, but cache/context cost reached USD 1.083331 and the budget guard stopped the run before any verdict or findings were returned. | BLOCKED — BUDGET EXHAUSTED BEFORE OUTPUT |
| 2026-08-29 | T031 resume attempt | `claude --print --resume 2cf9b39d-3db9-439d-9472-85c2291cca80 ...` | 1 | No conversation was retained because the review used `--no-session-persistence`; no additional inference ran. | BLOCKED — NO RETAINED SESSION |
| 2026-08-29 | T160 launch-policy red | Focused provider-adapter and desktop-launch contract tests | 1 | Four intended failures: runtime selection was absent from the preview and explicit model/effort produced no provider arguments. | EXPECTED RED |
| 2026-08-29 | T160–T161 focused green | `pnpm exec vitest run --project contract tests/contract/provider-adapter.test.ts tests/contract/desktop-ipc-launch.test.ts` | 0 | 2 files, 65 tests passed, including explicit/default choices, unsafe model rejection, preview binding, adapter propagation, and Codex/Claude argument mapping. | PASS |
| 2026-08-29 | T161 local CLI argument proof | Codex strict-config help parse; Claude model/effort help parse | 0 | Installed Codex accepted `--model` plus `model_reasoning_effort=low`; installed Claude accepted `--model fable --effort low`. No provider session or inference started. | PASS |
| 2026-08-29 | T161 launch-policy E2E | `pnpm desktop:build`; `pnpm exec playwright test tests/e2e/launch-session.spec.ts` | 0 | Desktop built and the one launch journey passed with visible Model/Effort controls, explicit review, boundary confirmation, and contained startup. | PASS |
| 2026-08-30 | T162 launch-policy red | `pnpm exec vitest run --project contract tests/contract/desktop-ipc-launch.test.ts` | 1 | Four intended failures proved the persisted runtime resolver and source-bound preview were absent while 23 prior launch contracts stayed green. | EXPECTED RED |
| 2026-08-30 | T162 focused contract green | `pnpm exec vitest run --project contract tests/contract/desktop-ipc-launch.test.ts` | 0 | 28 launch contracts passed, including independent field precedence through one-run, exact-profile revision, task-type, project, and CLI-default sources; low-cost test recommendations; and reason-bound high-cost holds. | PASS |
| 2026-08-30 | T162 launch-policy E2E | `pnpm desktop:build`; `pnpm exec playwright test tests/e2e/launch-session.spec.ts` | 1 then 0 | The first run found only a display-label mismatch in the new recommendation; the retry passed after using the provider-facing model label. The journey proves visible work type, model/effort sources, Low recommendation, conditional escalation reason, automatic preview refresh, and the unchanged single folder-boundary gate. | RED/GREEN PASS |
| 2026-08-30 | T162 broad deterministic gates | `pnpm format`; `pnpm lint`; `pnpm typecheck`; `pnpm test:unit`; `pnpm test:contract`; `pnpm test:integration:windows`; `git diff --check` | 0 | Formatting, lint, typecheck, 196 unit tests, 198 contract tests, and 67 Windows integration tests passed with one pre-existing skipped integration case. | PASS |
| 2026-08-29 | Launch-policy broad gates | `pnpm lint`; `pnpm typecheck`; `pnpm test:unit`; `pnpm test:contract`; scoped Prettier; `git diff --check` | 0 | Lint/typecheck passed; 18 unit files/120 tests and 7 contract files/136 tests passed; formatting and whitespace checks passed. | PASS |
| 2026-08-29 | T160 model-dropdown regression | `pnpm desktop:build`; `pnpm exec playwright test tests/e2e/launch-session.spec.ts` | 1 then 0 | The test first failed because Model was a textbox, then passed after adding provider-specific model options, CLI default, and a custom-model escape hatch. | RED/GREEN PASS |
| 2026-08-29 | T160 one-gate launch regression | `pnpm desktop:build`; `pnpm exec playwright test tests/e2e/launch-session.spec.ts` | 1 then 0 | The test first failed because the second settings-review button remained, then passed with automatic preview refresh, a persistent folder-boundary confirmation, and no second gate. | RED/GREEN PASS |
| 2026-08-29 | T031 current-tree pre-review | Focused US1 unit/persistence; coordination contract; desktop build; Windows delivery; coordination E2E | 0 | 5 unit files/35 tests, 1 contract file/13 tests, desktop build, 6 Windows tests, and 3 E2E journeys passed. | PASS |
| 2026-08-29 | T031 Claude independent review | Restricted read-only `claude-opus-5` / `high` review of US1 implementation, tests, and governing contracts | 0 | Reviewer returned one P1 false-delivery-on-session-teardown finding and one P2 production/domain-policy divergence; US1 was not approved. | FINDINGS — REMEDIATED |
| 2026-08-29 | T031 remediation red | Focused persistence regression; recipient-session-failure Windows regression | 1 | Persistence allowed `failed -> presenting`; recipient-only teardown returned attempt `applied`. Both failures reproduced the review findings before production changes. | EXPECTED RED |
| 2026-08-29 | T031 remediation focused green | Domain/persistence tests; recipient-session-failure Windows regression | 0 | 2 files/20 tests passed; the focused Windows case returned `unknown` and left the handoff `manual_actionable`. | PASS |
| 2026-08-29 | T031 post-remediation static and executable gates | Lint; typecheck; focused unit/persistence; coordination/session-stream contracts; desktop build; Windows delivery; coordination E2E; scoped Prettier; diff check | 0 | Lint/typecheck passed; 5 unit files/36 tests, 2 contract files/29 tests, desktop build, 7 Windows tests, and 3 E2E journeys passed; formatting and whitespace checks passed. | PASS |
| 2026-08-29 | T031 Claude re-review first continuation | Resumed restricted `claude-opus-5` / `high` review | 1 | USD 1.50 guard was reached during file inspection before a verdict; no finding was emitted. | BLOCKED — RETRIED FROM RETAINED SESSION |
| 2026-08-29 | T031 Claude final re-review | Resumed retained `claude-opus-5` / `high` review | 0 | Both P1/P2 remediations verified, no new P0–P2 issue introduced, final verdict `APPROVED FOR US1 MVP`; prior P3 observations remain non-blocking. | PASS |
| 2026-08-29 | T032 US2 model gate | `agy --version`; `agy models`; `claude --version`; `claude auth status`; exact minimal `claude-sonnet-5` / `high` probe | 0 | Antigravity 1.1.22 exposes primary `gemini-3.7-flash-medium` and fallback `gemini-3.6-flash-medium`; Claude Code 2.1.251 is authenticated and exact Sonnet 5 returned `AVAILABLE`. | PASS |
| 2026-08-29 | US2 Antigravity implementation run | `agy --print=...` with T033–T047-only scope | 1 | Stopped immediately at the user's request when the Antigravity usage percentage was observed decreasing. The interrupted run left partial edits and unchecked verification obligations; no Antigravity result was accepted as a gate. | INTERRUPTED — AUDITED LOCALLY |
| 2026-08-29 | US2 interrupted-output audit | `pnpm typecheck`; `pnpm lint`; focused contract/recovery/Cargo/E2E commands | 1 then 0 | Typecheck passed, but lint exposed 42 errors and both new US2 E2E cases failed. Local remediation replaced unsafe casts, repaired reachable conversation resolution/deletion, added real named-pipe/session-launch wiring, corrected pagination and retained-byte evidence, and removed false artifact assertions. | RED/GREEN PASS |
| 2026-08-29 | T033/T038–T043 bridge and launch contracts | Focused provider-coordination, desktop-launch, desktop-coordination, and provider-adapter contract suites | 0 | 4 files, 86 tests passed, including a real Windows named-pipe request, private per-session config creation/removal, authenticated sender derivation, bounded strict tools, launch injection, and manual degradation. Installed Codex and Claude help parsers also accepted the exact per-process MCP configuration forms without inference. | PASS |
| 2026-08-29 | T034/T042 recovery and history | Focused Windows coordination delivery and recovery suites | 0 | 2 files, 13 tests passed. Recovery now covers transport/outcome separation, delivered-parent causal replies, auto-resolution after terminal outcome, restart continuity, keyset pagination, retained-byte accounting, and inactive-content deletion. | PASS |
| 2026-08-29 | T035/T044–T045 conversation E2E | `pnpm desktop:build`; `pnpm exec playwright test tests/e2e/coordination.spec.ts` | 0 | Desktop built and 5 keyboard-driven journeys passed, including explicit conversation detail loading, separate transport/outcome labels, and delivered/completed inactive-content deletion. | PASS |
| 2026-08-29 | T036–T037 Rust bridge | Cargo format, clippy with warnings denied, bridge binary tests, and release build | 0 | 8 bridge tests passed; malformed/unknown/oversized frames, duplicate initialization, duplicate/out-of-order numeric IDs, private session config, method registry, safe diagnostics, and disconnect behavior passed. Release bridge built successfully. | PASS |
| 2026-08-29 | T046–T047 packaged bridge | Electron Forge x64 make; packaged-provider smoke; installed-app acceptance | 0 | Squirrel package completed; bridge was present under `app.asar.unpacked/out/main`; provider coordination smoke passed 3/3 and installed-app acceptance passed 5/5 on Windows 11 x64. Production fuses/native load/single-instance behavior passed. Artifact is unsigned and therefore not public-release ready. | LOCAL PACKAGE PASS — UNSIGNED |
| 2026-08-29 | T048 Claude independent review | Restricted read-only `claude-sonnet-5` / `high`; session `5be3d1f7-ad20-491c-8a29-ac153ec623c8`; USD 1.8243794 | 0 | Reviewer found one P1 renderer outcome-authority bypass, one P2 gap in proving the real packaged bridge inherited Job Object containment, and one P3 test that asserted impersonation without submitting a forged sender field. Verdict: `CHANGES REQUIRED`. | FINDINGS — REMEDIATED LOCALLY |
| 2026-08-29 | T048 review remediation | Removed renderer `coordination.reportOutcome`; authenticated outcomes remain provider-bridge-only; added a test-only provider hook with live-session/recipient enforcement; added a real forged-sender rejection; exact native bridge PID Job Object proof | 0 | Focused contract 21/21, exact containment proof 3/3, focused recovery 13/13, and coordination E2E 5/5 passed. The production renderer has no outcome-report operation; the real release/debug Rust bridge is spawned by the contained provider fixture and independently verified in the same Job Object by PID. | PASS — RE-REVIEW PENDING |
| 2026-08-29 | US2 broad regression | `pnpm format`; `pnpm lint`; `pnpm typecheck`; `pnpm test:unit`; `pnpm test:contract`; full serialized Windows integration | 0 | Format/lint/typecheck passed; 17 unit files/120 tests, 8 contract files/145 tests, and 12 integration files/42 passed with 1 intentional skip after excluding the unrelated session-host work. | PASS |
| 2026-08-29 | Spec Kit checkpoint analysis and scope remediation | Read-only `speckit-analyze`; compare 66 FRs, 28 SCs, 162 unique sequential tasks, constitution, plan, and current diff | 0 | No constitution conflict, missing task ID, placeholder, material duplication, or unmapped implementation task. The analysis found the explicit preserve-only session-host files in the feature diff and a 100-versus-1,000 handoff acceptance mismatch. The original combined commit is retained at local branch `codex/recovery-002-pre-scope-split`; the three unrelated files are absent from the feature diff; T151 now requires the SC-002 1,000-handoff retry/duplicate measurement. | PASS — REMEDIATED WITH OWNER APPROVAL |
| 2026-08-29 | Post-rebase checkpoint gates | Full Vitest; Playwright; format/lint/typecheck; Rust format/clippy/tests; package; provider smoke; installed acceptance | 0 | Rebased onto `origin/main` `01e54ce`. Full Vitest passed 38 files with 2 skipped and 309 tests with 10 skipped; Playwright passed 14/14; Rust passed 17 supervisor and 8 bridge tests; provider smoke passed 3/3; installed acceptance passed 5/5. | PASS |
| 2026-08-29 | T046–T048 rebuilt package | Native release build; Electron Forge x64 make; packaged-provider smoke; installed-app acceptance | 0 | Rebuilt after review and scope remediation. Provider smoke passed 3/3 and installed-app acceptance passed 5/5 against `release/ThreadHelm-win32-x64/ThreadHelm.exe`; the packaged bridge is present under ASAR-unpacked resources. Artifact remains unsigned and is not public-release ready. | LOCAL PACKAGE PASS — UNSIGNED |
| 2026-08-29 | T048 Claude re-review continuation | Resumed read-only `claude-sonnet-5` / `high` session `5be3d1f7-ad20-491c-8a29-ac153ec623c8` | 1 (USD guards) | The USD 1.50 inspection continuation and USD 0.60 zero-tool conclusion wrapper both hit prompt-cache budget guards before printing their generated text. The retained local session record contained Claude's completed review: all three findings fixed, no new P0–P2 issues, verdict `APPROVED FOR US2`. No further inference call was made. | PASS — APPROVED FOR US2 |
| 2026-08-29 | T049 US3 model gate, bare probe | `claude auth status`; bare exact `claude-opus-5` / `high` minimal probe | 1 | Authentication status was valid, but bare mode returned `Not logged in` before inference with zero tokens and zero cost. This mode mismatch was not treated as a model result. | FAIL — RETRIED IN PROVEN NORMAL MODE |
| 2026-08-29 | T049 US3 model gate, normal probe | `claude --print --model claude-opus-5 --effort high --tools '' --max-turns 1 --max-budget-usd 0.75 ...` | 0 | Claude Code 2.1.251 resolved canonical `claude-opus-5` and returned exactly `AVAILABLE`; 2 input, 9 output, and 38,763 one-hour cache-creation tokens were reported at USD 0.387865. | PASS — PRIMARY AVAILABLE |
| 2026-08-29 | US3 Opus read-only implementation brief | Bounded normal-mode `claude-opus-5` / `high`, plan permission, read/grep/glob tools only | 130 | The process emitted no conclusion within the bounded wait and was terminated. It made no repository edits and produced no accepted implementation or review evidence. | INTERRUPTED — NO RESULT USED |
| 2026-08-29 | T050 provider lifecycle contract red | `pnpm exec vitest run --project contract tests/contract/provider-coordination.test.ts` | 1 | Three intended failures: legacy scalar capability, absent lifecycle ingestion, and absent strict evidence schema; seven US2 bridge tests remained green. | EXPECTED RED |
| 2026-08-29 | T050/T053/T056 provider lifecycle contract green | Focused provider-coordination contract | 0 | 10/10 passed: built-in manual fallback, fixture exact-version capability, strict content-free schema, auth, fresh acceptance, dedupe, stale/cross-session/version/pending-draft rejection. | PASS |
| 2026-08-29 | T051 Windows lifecycle red | Focused serialized coordination-delivery integration | 1 | Two intended failures at the absent test-only authenticated lifecycle hook; seven existing delivery tests passed. | EXPECTED RED |
| 2026-08-29 | T051/T057/T058 Windows lifecycle green | Focused serialized coordination-delivery integration | 0 | 9/9 passed: one safe point presents one oldest queued handoff; stale/draft-unknown/power/provider-failure paths create no attempt; prior manual, crash, duplicate, ordering, and isolation cases remain green. | PASS |
| 2026-08-29 | T052 lifecycle E2E red/green | Focused `safe lifecycle` Playwright journey | 1 then 0 | Failed first at the absent hook, then passed with stable handoff-ID targeting: proved fixture evidence delivers once and unknown draft safety visibly changes the handoff to `manual_actionable`. | RED/GREEN PASS |
| 2026-08-29 | T059 deterministic provider lifecycle acceptance | Provider-coordination acceptance smoke | 0 | 6 passed, 1 packaged-only skip. Codex and Claude built-ins remain manual; exact fixture versions separately prove safe point, pending-draft downgrade, power invalidation, isolation, and credential cleanup. | PASS — DETERMINISTIC ONLY |
| 2026-08-29 | US3 local regression | Lint; typecheck; full unit; full contract; focused Windows delivery; full coordination E2E; scoped Prettier; diff check | 0 | Lint/typecheck passed; unit 120/120, contract 148/148, Windows delivery 9/9, coordination E2E 6/6, formatting and whitespace checks passed. | PASS — LIVE PROVIDER PROOF/REVIEW OPEN |
| 2026-08-29 | T060 OpenAI Sol fault-review attempt | Read-only `gpt-5.6-sol` / `max` review of the current US3 diff | interrupted | The reviewer returned no findings or verdict after repeated bounded waits and was stopped. No review evidence was accepted. | OPEN — REVIEW NOT COMPLETE |
| 2026-08-29 | US3 final current-tree verification | Fresh lint; typecheck; full unit; full contract; desktop build; focused Windows delivery; full coordination E2E; provider-coordination acceptance; scoped formatting and diff audit | 0 | Lint/typecheck passed; unit 120/120, contract 148/148, desktop main/preload/renderer built, Windows delivery 9/9, coordination E2E 6/6, provider acceptance 6 passed with 1 packaged-only skip, and final formatting/whitespace checks passed. | PASS — T054/T055/T060 REMAIN OPEN |
| 2026-08-29 | US3 branch refresh | `git fetch --prune origin`; `git rebase --autostash origin/main` | 0 | Rebased the dirty US3 branch onto `origin/main` `e9d2d7c`; Git reapplied all 17 intended files without conflict. | PASS |
| 2026-08-29 | T054 exact Claude lifecycle proof | Claude Code 2.1.251 authenticated; restricted tool-free `claude-opus-5` / `high` turns with an invocation-only `Stop` hook and sanitized key inspection; official 2.1.251 hook schema | 0 final | The live `Stop` hook fired after `end_turn`. Its sanitized fields were `background_tasks`, `cwd`, `effort`, `hook_event_name`, `last_assistant_message`, `permission_mode`, `prompt_id`, `session_crons`, `session_id`, `stop_hook_active`, and `transcript_path`; no pending-draft/editor/queued-input field exists. The successful and diagnostic inference calls reported USD 0.0446575 total. Raw message/transcript values were not persisted. | PASS — EXACT 2.1.251 MANUAL-ONLY FALLBACK |
| 2026-08-29 | T055 exact Codex lifecycle proof | Codex CLI 0.150.1 authenticated; stable hooks inventory; exact tagged 0.150.1 `Stop` schema; locally generated experimental app-server schema; ephemeral isolated `codex exec` turn with an invocation-only vetted hook | 0 | The exact `Stop` schema exposes session ID, turn ID, event name, model, permission mode, stop state, transcript path, and last message, while app-server exposes `turn/completed` and thread status. Neither surface exposes the open TUI's pending draft/editor/queued-input state. The live Luna/low probe completed with 16,464 input, 8,960 cached input, 11 output, and no repository tool call. | PASS — EXACT 0.150.1 MANUAL-ONLY FALLBACK |
| 2026-08-29 | T060 independent fault review, first pass | Read-only OpenAI `gpt-5.6-sol` / `max` review of the rebased US3 tree | changes required | The reviewer found future-skew/replay acceptance, incorrect automatic-attempt attribution, windowed oldest-queued selection, absent P4 opt-in protection for provider replies, incomplete manual-state transitions, and stale renderer state. Regression tests were added before remediation. | FINDINGS — REMEDIATED |
| 2026-08-29 | T060 fault remediation | Provider contract, service/persistence unit, real Windows named-pipe delivery, and visible E2E slices | 0 | Future timestamps now fail closed; event/turn IDs remain deduplicated for the credential lifetime with a bounded fail-closed ceiling; automatic attempts use provider lifecycle evidence/actor; oldest queued selection is direct; provider replies remain manual before P4 opt-in; known manual-only or bridge-unhealthy recipients initialize/retarget manual; all affected work downgrades and publishes on bridge loss. | PASS |
| 2026-08-29 | T060 transport re-review | Real named-pipe EOF before a completed exchange, normal completed ephemeral close, recipient isolation, and subsequent-work checks | 0 | Incomplete pipe `end`/`close`/`error` uses one idempotent disconnect path, invalidates only that credential, changes only that recipient's queued handoffs to `manual_actionable`, publishes each change, and keeps later work manual. A completed request close remains healthy. | PASS |
| 2026-08-29 | T060 OpenAI Sol final review | Independent read-only `gpt-5.6-sol` / `max` fault re-review of branch `codex/002-provider-coordination-us3` at base `e9d2d7c` | 0 | No P0–P3 findings remain. Approval is limited to US3: one oldest user-origin item per proved safe point; provider replies still require T066/P4 opt-in; built-in Claude 2.1.251 and Codex 0.150.1 remain manual-only. | PASS — APPROVED FOR US3 |
| 2026-08-29 | T060 final current-tree verification | Lint; typecheck; full unit; full contract; desktop build; focused Windows delivery; full coordination E2E; provider acceptance; scoped formatting and whitespace audit | 0 | Lint/typecheck passed; unit 121/121, contract 150/150, desktop main/preload/renderer built, Windows delivery 13/13, coordination E2E 6/6, provider acceptance 6 passed with 1 packaged-only skip, scoped Prettier passed, and `git diff --check` passed. | PASS — US3 COMPLETE |
| 2026-08-29 | T061 US4 model and reviewer gate | Codex CLI 0.150.1 exact tool-free read-only probes for `gpt-5.6-sol` / `max` and `gpt-5.6-terra` / `max`; Claude Code 2.1.251 exact tool-free `claude-opus-5` / `xhigh` probe; `agy models`; active human-owner instruction | 0 | Sol and Terra returned their exact availability markers; Claude resolved canonical `claude-opus-5` and returned its exact marker at USD 0.032029; Antigravity 1.1.22 lists optional `gemini-3.1-pro-high`; the human owner explicitly started the next sequence. Codex emitted unrelated configured-MCP authentication warnings but completed both probes without tool use. | PASS — IMPLEMENTATION ASSIGNED; FINAL REVIEWS/OWNER ACCEPTANCE REMAIN T070 |
| 2026-08-29 | T071 US5 model and reviewer gate | `agy --version`; `agy models`; `claude --version`; `claude auth status`; exact tool-free `claude-opus-5` / `high` marker probe | 0 | Antigravity 1.1.22 exposes primary `gemini-3.1-pro-high` and fallback `gemini-3.7-flash-medium`; Claude Code 2.1.251 is first-party authenticated and returned the exact US5 reviewer marker. | PASS — IMPLEMENTATION ASSIGNED; REVIEW REMAINS T088 |
| 2026-08-29 | T089 US6 model and verifier gate | `claude --version`; `claude auth status`; exact tool-free `claude-sonnet-5` / `high` marker probe; `codex --version`; exact read-only `gpt-5.6-sol` / `high` marker probe | 0 | Claude Code 2.1.251 returned `THREADHELM_US6_PRIMARY_AVAILABLE`; Codex CLI 0.150.1 returned `THREADHELM_US6_VERIFIER_AVAILABLE`. The Opus fallback was not invoked because the primary passed. Claude owns schema/runtime compatibility and cost review; OpenAI independently verifies stable-ID authority separation, deterministic behavior, and privacy. Owner clarification: `Tony Stark` and every other persona/display name are mutable presentation data; stable internal profile/supervisor IDs and immutable revisions remain the only identity inputs to routing, permissions, memory, launch, and audit. | PASS — IMPLEMENTATION GATE OPEN |
| 2026-08-29 | US6 primary implementation assignment | Bounded `claude-sonnet-5` / `high` run for T090–T105 | 1 (interrupted) | The run remained in analysis for more than six minutes, produced no repository edits or executable test result, and was terminated. No implementation evidence from the stalled run is accepted. | NO RESULT — CONTINUE LOCALLY |
| 2026-08-29 | T090–T095 US6 executable RED and fixtures | Focused domain/persistence unit, contract, Windows integration, and Playwright roster commands after building the fixture package | 1 each (expected) | Unit executed 32/32 intended failures at absent domain/schema/repository behavior; contract executed 16 intended failures plus one existing disclosure-store pass; Windows executed 6/6 intended failures at the absent profile picker/import surface; Playwright executed 5/5 intended failures at the same absent production hook. Sanitized fixtures include ten roster manifests plus duplicate, revised, hostile, unavailable, excessive, and changed-after-preview cases. | EXPECTED RED |
| 2026-08-29 | T096 profile domain/contracts GREEN | Focused profile domain and contract Vitest files | 0 | Domain 23/23 and contracts 17/17 passed after enforcing strict hire schema, bounded normalization, mutable-name/stable-ID separation, exact compatibility, narrowing-only budgets, lifecycle policy, strict views/requests/events, and one-use drift failure. | PASS |
| 2026-08-29 | T097–T098 persistence GREEN | Bypass-authorized streamed `claude-sonnet-5` / `high` persistence-only run; independent local focused Vitest, Prettier, and diff checks | 0 | Claude completed without approval loops at USD 0.8316102; local audit passed 9/9 persistence tests, formatting, and whitespace checks. Migration v3 now contains profile/revision/pin tables and indexes; repository import is digest-idempotent, revision-pinned, transactional, and mission-pin guarded. | PASS |
| 2026-08-29 | T072–T075 executable RED | Focused domain, persistence, contract, and Windows shared-memory Vitest files | 1 each | 6 domain, 8 persistence, 5 contract, and 5 Windows cases failed at absent US5 policies, schema/repository, operations/views, and repository surfaces. All files parsed and executed; no fake throw helper or syntax failure remained. | EXPECTED RED |
| 2026-08-29 | T076 executable RED | Desktop build; focused `hive-memory.spec.ts` | 1 | Desktop built, then both real fixture journeys timed out at the absent accessible `Shared memory` control. | EXPECTED RED |
| 2026-08-29 | T072/T077 domain GREEN | Focused shared-memory domain Vitest | 0 | 6/6 passed: lifecycle matrix, exact scope/author, stable sources, immutable content, confirmed deletion, and confidence/rank non-authority. | PASS |
| 2026-08-29 | T073/T078/T079 persistence GREEN | Focused persistence and Windows shared-memory Vitest | 0 | Persistence 8/8 and Windows 5/5 passed, including transactional v3/FTS, append-only revision/conflict lineage, quotas, stable cursor, rollback, 10,000 revisions, restart, scope isolation, explicit-ingestion boundary, and deletion cleanup. | PASS |
| 2026-08-29 | T074 contract GREEN | Focused shared-memory contract Vitest | 0 | 5/5 passed: strict scopes, 20-result/4 KiB bounds, content-free summary versus explicit detail, named preview/confirm operations, and provider inputs that cannot choose scope or author. | PASS |
| 2026-08-29 | T080–T087 US5 consolidated deterministic gate | Shared-memory domain, persistence, desktop/provider contracts, Windows repository/performance, and provider acceptance Vitest files | 0 | 8 files passed, 69 tests passed, and 1 packaged-path conditional skip. Coverage includes 10,000 revisions, FTS p95 under 500 ms, open-panel idle cost, deletion-index cleanup, authenticated provider attribution, cross-scope denial, and absent transcript/owner bridge tools. | PASS |
| 2026-08-29 | T083–T085 US5 desktop journey | Desktop build; focused `hive-memory.spec.ts` | 0 | Main/preload/renderer built and 2/2 keyboard journeys passed: durable publish/search/detail/retract/delete plus a calm list/detail surface with no graph, canvas, or animation. | PASS |
| 2026-08-29 | T081 US5 Rust bridge | Cargo format; warnings-denied Clippy; coordination-bridge binary tests | 0 | Format and Clippy passed; 8/8 bridge tests passed with the three bounded memory tools in discovery and no owner-only deletion/conflict method. | PASS |
| 2026-08-29 | T088 US5 static gate initial | Full format; lint; typecheck; desktop build | 2 then 0 | Format/lint/build passed; typecheck exposed an exact-optional spread in the new provider acceptance fixture. The fixture now copies only present fields; its 7 tests plus 1 conditional skip and the full TypeScript build pass. | RED/GREEN PASS |
| 2026-08-29 | T088 Antigravity implementation evidence | Two Pro test-draft attempts; bounded Flash Medium read-only audit attempts | 0 drafts / no audit verdict | Both Pro drafts were rejected before production use because they contained synthetic missing-export assertions and invalid escaped TypeScript. Flash was invoked as the quota-preserving fallback: its first sandbox run could not obtain read permission and its second timed out without a response. No Antigravity code or verdict is claimed as accepted evidence; deterministic tests remain authoritative. | EVIDENCE CAPTURED — NO MODEL VERDICT |
| 2026-08-29 | T088 Claude independent review | Read-only `claude-opus-5` / `high`; retained session `ce983938-6e11-48e3-8110-aff34fd02156` | budget guards | The USD 3.00 inspection and USD 1.25 conclusion guards stopped the CLI wrappers after generation; the retained local session record contained one P1, four P2, and six P3 reproducible findings with verdict `CHANGES REQUIRED`. Total reported cost was USD 4.6299745. | FINDINGS — REMEDIATED LOCALLY |
| 2026-08-29 | T088 review remediation RED | Focused persistence and shared-memory contract tests | 1 | Six intended failures reproduced contested supersession losing conflict state, revoked-scope supersession, non-canonical null scope equality, unbounded retained bytes, missing competing entry IDs, and absent publication expiry. | EXPECTED RED |
| 2026-08-29 | T088 review remediation GREEN | Lint; typecheck; focused US5 unit/contract/provider/Windows slices; desktop build; expanded memory E2E | 0 | Focused Vitest passed 66 tests with 1 packaged-path skip; four E2E journeys passed conflict resolution, modal focus/Escape, state resync, active-only default, explicit pagination, expiry, and the prior publish/search/retract/delete/no-animation paths. Lint, TypeScript, and desktop build passed. | PASS — RE-REVIEW PENDING |
| 2026-08-29 | T088 Claude remediation re-review | Resumed read-only `claude-opus-5` / `high` session `ce983938-6e11-48e3-8110-aff34fd02156`; USD 3.2447885 | 0 | Claude verified all original 11 findings closed, then found one new P2 stale/retracted-resolution reactivation path and one P3 filter/cursor mismatch. Verdict remained `CHANGES REQUIRED`. | FINDINGS — REMEDIATED LOCALLY |
| 2026-08-29 | T088 second remediation | Current-contested resolution unit regressions; cursor-invalidation E2E; typecheck; desktop build | 1 then 0 | RED reproduced resurrection/stale-revision acceptance and the absent searchable-current index. GREEN requires the exact current contested revision, enforces one searchable current revision per entry, invalidates cursors on every bound input change, passes 18 unit tests and all 4 memory E2E journeys. | RED/GREEN PASS — FINAL RE-REVIEW PENDING |
| 2026-08-29 | T088 Claude final re-review | Resumed read-only `claude-opus-5` / `high` session `ce983938-6e11-48e3-8110-aff34fd02156`; USD 2.6638065 | 0 | Claude verified both second-order regressions closed, the searchable-current index consistent with every writer, no new P0–P3 issue, and returned exact verdict `APPROVED FOR US5`. | PASS — APPROVED FOR US5 |
| 2026-08-29 | T088 full Vitest initial | `pnpm format`; `pnpm lint`; `pnpm typecheck`; `pnpm test` | 1 | Static gates passed; full Vitest found only two stale schema-ledger expectations after v3 introduced the memory tables/version. The remaining 378 tests passed with 10 skips. | FAIL — FIXED |
| 2026-08-29 | T088 full repository final | Format; lint; typecheck; full Vitest; desktop build; Rust format/Clippy/tests; full Playwright | 0 | Format/lint/typecheck/build passed; Vitest passed 42 files and 380 tests with 10 intentional skips; Rust passed 17 supervisor and 8 bridge tests; Playwright passed all 21 keyboard/recovery/isolation journeys. | PASS — US5 COMPLETE LOCALLY |
| 2026-08-29 | T062 US4 domain policy red | `pnpm exec vitest run --project unit tests/unit/domain/coordination.test.ts` | 1 | Six intended failures at the absent `evaluateAutomaticContinuation` policy cover depth eight/ninth hold, third exact repeat within eight, third consecutive failure, allowed/held message kinds, paused/closed late messages, opt-in, conflict, and authority. Ten prior domain tests remained green. | EXPECTED RED |
| 2026-08-29 | T063 US4 contract red | `pnpm exec vitest run --project contract tests/contract/desktop-ipc-coordination.test.ts` | 1 | Three intended failures for absent strict auto-continue disclosure/confirmation, escalation/disposition schemas, and named operations. Fourteen prior coordination contract tests remained green. | EXPECTED RED |
| 2026-08-29 | T063 US4 E2E red | Focused Playwright `bounded coordination|authority escalation` | 1 | The first journey timed out at the absent enable-disclosure control; the second failed at the absent `coordination.previewAutoContinue` operation. Both failures occurred at the intended missing US4 surfaces. | EXPECTED RED |
| 2026-08-30 | T166 isolated Claude auto proof | Disposable non-root Docker/WSL2 worker, internal-only network, exact-domain Squid proxy, read-only credential mount, tmpfs config/workspace, Claude Code `2.1.251` | 0 final | Canonical `claude-opus-5`, first-party provider, and real `auto` completed a five-turn Read/Edit/Bash repair; `node test.js` printed `TEST_PASS`. A critical-path `rmdir /` request emitted `permission_denied` for Bash and left `/` intact. | PASS — LIVE PROVIDER PROOF |
| 2026-08-30 | T166 unavailable-auto and stop proof | Unsupported Haiku auto request; streamed elapsed-bound cancellation; blackhole-proxy no-progress cancellation | 0 / 143 stops | Haiku silently initialized as `default`, never bypass; the supported Opus session streamed progress before SIGTERM with no terminal result; the blackhole case had zero assistant/tool/result events at the six-second threshold. ThreadHelm must preflight/hold unavailable auto and must not retry unknown cancellation. | PASS — PROVIDER EDGE RECORDED |
| 2026-08-30 | T166 deterministic permission/outcome slices | Unit launch policy; provider/desktop contracts; Windows permission policy | 0 | Unit 7/7, contract 83/83, and Windows integration 2/2 passed. The first Windows invocation used nonexistent project filter `integration-windows`, ran no tests, and was corrected to `integration`. | PASS AFTER COMMAND FILTER CORRECTION |
| 2026-08-30 | T166 cleanup | Exact label/name inspection followed by removal of proof containers, internal network, four proof images, proxy config, tmpfs workspace, and tmpfs Claude config | 0 | No T166 container, network, image tag, or temporary proxy file remains. The only mounted host file was the 25,218-byte Claude credential, read-only; its size is unchanged. | PASS — VERIFIED CLEAN |

### T166 installed Claude auto-mode compatibility proof

- **Authority and exact provider surface**: host Claude Code and the disposable image both reported
  `2.1.251`. Sanitized authentication fields were `loggedIn: true`, `authMethod: claude.ai`,
  `apiProvider: firstParty`, and `subscriptionType: max`. No organization identifier, credential
  value, prompt, transcript, or raw model message was persisted. The successful stream initialized
  canonical `claude-opus-5` with `permissionMode: auto`, `cwd: /workspace`, and first-party model
  usage. This is live-provider evidence, separate from the deterministic tests below.
- **Containment**: Docker Desktop `4.84.0` / Engine `29.6.2` supplied a Linux/WSL2 container. The
  worker ran as UID/GID `1000:1000`, with a read-only root filesystem, every Linux capability
  dropped, `no-new-privileges`, 128 PIDs, 2 GiB memory, two CPUs, and only three writable tmpfs
  mounts: `/workspace`, `/tmp`, and `/claude-config`. The exact proof image ID was
  `sha256:6be6668946ac1a441c00b942ada2eab6587810df199a99d68d5d7a462e14d486`.
- **Credential/environment boundary**: only `%USERPROFILE%/.claude/.credentials.json` was mounted at
  `/run/secrets/claude-credentials.json`, read-only, then copied into the disposable config tmpfs.
  Host/project settings, Git/SSH credentials, repository contents, and ambient host environment were
  not mounted or inherited. Explicit environment names were limited to config/home/proxy controls,
  traffic-disable switches, and the base image's `PATH`, Node, and Yarn version fields.
- **Network boundary**: the worker joined only an `--internal` Docker network and had no direct
  internet route. Its HTTP(S) proxy allowed only `api.anthropic.com`, `platform.claude.com`, and
  `claude.ai`, the provider/control endpoints listed in the official
  [network requirements](https://code.claude.com/docs/en/network-config#network-access-requirements).
  Connectors, artifacts, updates, telemetry, and error reporting were disabled. A preflight reached
  `api.anthropic.com` through the proxy, an `example.com` CONNECT was denied with 403, and a direct
  request timed out. Final proxy logs contained 16 accepted tunnels, all to
  `api.anthropic.com:443`, plus the one intentional denied `example.com:443` probe; no other
  destination appeared.
- **Harmless read/edit/test**: exact flags included `--model opus --effort low --permission-mode
  auto --tools Read,Edit,Bash --output-format stream-json --max-turns 6 --max-budget-usd 0.75
  --no-session-persistence`. Claude read the two-file fixture, changed subtraction to addition, and
  ran the independent test successfully. The stream reported five turns, 9,423 ms total, 8 input,
  6,252 cache-creation, 17,608 cache-read, and 359 output tokens, zero WebSearch/WebFetch requests,
  and USD `0.080339`; the corrected file SHA-256 was
  `48acf6918209bb54830373fa887db5fd3590f71cbf9c7504fe0e1a6834e7238b`.
- **Classifier denial**: in the same outer boundary, the documented critical-path request `rmdir /`
  produced a streamed `system/permission_denied`, one denied Bash tool, and no filesystem change.
  The terminal result reported two turns and USD `0.0181475`. This matches the official
  [auto classifier boundary](https://code.claude.com/docs/en/permission-modes#eliminate-permission-prompts-with-auto-mode),
  which keeps critical-path removal subject to the classifier even when routine auto work proceeds.
- **Unavailable auto never becomes bypass**: requesting `auto` with unsupported Haiku initialized
  `claude-haiku-4-5-20251001` in `permissionMode: default`, with no bypass flag or bypass event. The
  CLI still completed one inference turn and reported USD `0.014257`; it did not emit an unavailable
  error. Therefore ThreadHelm's exact capability gate must hold before launch instead of relying on
  the CLI to fail closed. The deterministic Windows slice proves absent auto capability produces
  `held` and that generated argv contains no bypass.
- **Progress, elapsed cancellation, no progress, and unknown usage**: a supported Opus auto process
  emitted init and Bash progress, then the external elapsed-bound stop ended it with exit `143`, no
  OOM, and no terminal `result`. A repeated cancellation captured the last intermediate assistant
  usage as 2 input, 293 cache-creation, 4,232 cache-read, and 2 output tokens before the same no-result
  stop. With a local blackhole proxy, the installed CLI emitted zero assistant, tool, user, or result
  events at the six-second no-progress observation point and was stopped with exit `143` without a
  TLS/provider connection. Five completed exploratory/proof result streams reported USD `0.182733`
  in aggregate; the forced-cancel streams had no terminal cost field. ThreadHelm must therefore
  preserve intermediate usage separately, return timeout/cancel/no-progress as distinct main-owned
  outcomes, and treat missing terminal accounting as unknown rather than zero or safe-to-retry.
- **Deterministic separation**: `launch-policy.test.ts` passed 7/7,
  `provider-adapter.test.ts` plus `desktop-ipc-launch.test.ts` passed 83/83, and
  `provider-permission-policy.test.ts` passed 2/2. These cover capability drift, progress bounds,
  typed permission/classifier/timeout/cancel/no-progress/budget/unknown outcomes, held unavailable
  auto, and bypass exclusion without spending provider usage.
- **Cleanup**: exact labels/names were inspected before deletion. All worker/proxy/blackhole
  containers, the internal network, the proof/Squid/curl/Node images, the temporary proxy config,
  and every tmpfs workspace/config were removed. A final inventory returned zero proof containers,
  networks, or image tags and no temporary file. No bypass invocation was needed or performed.

## Cost-aware implementation delegation

Mechanical, file-isolated setup work used `gpt-5.6-luna` at `medium`; architectural integration
remains with the primary agent. This keeps high-cost story models reserved for their explicit model
gates and independent review rather than routine scaffolding.

| Task | Delegated scope | Model / effort | Result |
|---|---|---|---|
| T002 | Deterministic fixtures | `gpt-5.6-luna` / `medium` | PASS |
| T003 | Compile-only Rust target | `gpt-5.6-luna` / `medium` | PASS |
| T004 | Additive Windows harness | `gpt-5.6-luna` / `medium` | PASS |
| T010 | Bridge protocol fixtures | `gpt-5.6-luna` / `medium` | PASS |
| T011 | Main-owned service seam | `gpt-5.6-luna` / `medium` | PASS |
| T012 | Disclosure-token store | `gpt-5.6-luna` / `medium` | PASS |
| T015/T019 | US1 domain invariants | `gpt-5.6-sol` / `high` | PASS |
| T016 | Persistence red tests | `gpt-5.6-luna` / `medium` | RED VERIFIED; primary agent tightened false positives |
| T018 | Windows delivery red tests | `gpt-5.6-luna` / `medium` | RED VERIFIED |
| T159 | Launch-policy specification/task reconciliation | `gpt-5.6-luna` / `low` | PASS |

### US1 model gate decision

- The current Codex host inventory advertises `gpt-5.6-sol` with `high` and `gpt-5.6-terra` with
  `xhigh`; Sol owns the domain/persistence/authority-critical slice and Terra is available only if
  Sol cannot complete it.
- Claude Code 2.1.251 resolved `claude-opus-5` as the canonical first-party model at `high`.
  It remains the independent verifier and must not implement the slice it reviews.
- The availability probe unexpectedly created a large prompt-cache charge (reported USD 0.392475)
  despite the USD 0.05 guard. Do not repeat model probes or use Opus for mechanical work; reserve it
  for the required US1 review after local gates pass.
- Verifier responsibility: examine exact-recipient binding, one-recipient invariants, at-most-once
  delivery, unknown-outcome recovery, disclosure snapshot binding, and absence of content in broad
  events/errors. Fallback was not invoked because the primary host model is available.

### US2 model gate decision

- Antigravity CLI 1.1.22 currently exposes primary `gemini-3.7-flash-medium` and same-ecosystem
  fallback `gemini-3.6-flash-medium`. The primary owns the broad but bounded conversation,
  provider-bridge, deletion, renderer, and accessibility slice.
- Gemini Flash Medium is selected to conserve Antigravity five-hour/weekly quota relative to the
  Pro-class models while retaining enough context for the cross-layer US2 work. The 3.6 fallback was
  verified in the same live inventory but not invoked because the primary is available.
- Claude Code 2.1.251 is authenticated, and an exact minimal `claude-sonnet-5` / `high` call resolved
  the canonical model and returned `AVAILABLE` without repository tools or edits.
- Verifier responsibility: independently review causal integrity, authenticated sender/derived
  recipient behavior, acknowledgement-versus-outcome separation, restart continuity, inactive-content
  deletion, bridge isolation, and keyboard-only conversation flows after deterministic gates pass.

### US3 model gate decision

- Claude Code 2.1.251 is authenticated through the first-party service. A normal-mode, tool-free,
  one-turn probe resolved canonical `claude-opus-5` at `high` and returned `AVAILABLE`; the primary
  may own the provider-evidence contract and lifecycle race analysis for this safety-critical slice.
- The first `--bare` probe did not inherit the authenticated session and returned `Not logged in`
  before inference. It consumed zero tokens and is recorded as a probe-mode failure, not as provider
  or model unavailability.
- The approved `claude-sonnet-5` / `xhigh` fallback was not invoked because the primary succeeded.
  This avoids another large prompt-cache charge; it remains the only same-ecosystem fallback and
  must be re-probed if Opus becomes unavailable before work is assigned.
- The current Codex host inventory exposes `gpt-5.6-sol` with `max`, reserved for the independent
  T060 fault-injection review. It must verify stale, duplicate, cross-session, power-transition,
  pending-draft, provider-failure, and no-replay behavior after deterministic tests pass.
- Opus/maximum effort is restricted to lifecycle semantics and review. Deterministic fixture tests
  remain the acceptance authority; no model statement can establish safe-point support by itself.

### US4 model gate decision

- Codex CLI 0.150.1 completed isolated, ephemeral, read-only, tool-free probes for both the primary
  `gpt-5.6-sol` / `max` and the same-ecosystem fallback `gpt-5.6-terra` / `max`. Sol is assigned to
  the authority-critical US4 policy slice; Terra remains available only as the approved fallback.
- The probes emitted authentication warnings for unrelated configured MCP servers, but both model
  turns completed successfully and used no repository tools. Those optional MCP warnings do not
  establish a US4 product or test dependency.
- Claude Code 2.1.251 completed a safe-mode, tool-free, non-persistent probe that resolved canonical
  `claude-opus-5` at `xhigh` and returned the exact availability marker. It remains independent and
  must not be used to implement the code it will adversarially review at T070.
- Antigravity CLI 1.1.22 lists optional `gemini-3.1-pro-high`; it may provide the second independent
  review if quota permits, but its absence or non-use does not replace the required Claude/human gate.
- The human owner is present and explicitly authorized starting this US4 sequence. Final human
  acceptance of depth, loop, failure, conflict, closed-state, and consequential-authority behavior
  remains open until T070; availability is not acceptance.
- Maximum-effort frontier use is restricted to US4 policy and adversarial review. Deterministic red/
  green tests, Windows isolation evidence, and explicit owner acceptance remain authoritative.

### US5 model gate decision

- Antigravity CLI 1.1.22 currently exposes the approved primary `gemini-3.1-pro-high` and the only
  approved same-ecosystem fallback, `gemini-3.7-flash-medium`. Pro is assigned to the cross-layer
  revision, FTS, conflict, deletion, bridge, and compact UI slice; no provider substitution is made.
- Gemini Pro consumes the scarcer five-hour/weekly quota. Two test-draft attempts were rejected
  before production use because they contained invalid or synthetic assertions. Flash Medium was
  then invoked as the quota-preserving fallback for a read-only audit; permission denial followed by
  a bounded timeout produced no verdict. No Antigravity output is treated as accepted implementation
  or review evidence.
- Claude Code 2.1.251 is authenticated through the first-party service. An exact tool-free one-turn
  probe resolved canonical `claude-opus-5` at `high` and returned
  `THREADHELM_US5_REVIEWER_AVAILABLE`. It remains independent and must not implement the slice it
  reviews at T088.
- Deterministic domain, persistence, contract, Windows, E2E, quota, and privacy tests own acceptance.
  The reviewer must independently inspect scope derivation, immutable attribution, conflict
  preservation, content-free lineage, FTS deletion, bounded excerpts/results, and the absence of
  terminal, transcript, reasoning, credential, environment, or workspace-file ingestion.

## Historical story checkpoints (US5 closure)

This table preserves the US5-era snapshot. The later US6, US7, US8 and final verification entries
below supersede it; pending cells here are not the current feature status.

| Story | Unit/domain | Persistence | Contract | Windows integration | E2E | Provider/installed proof | Independent review | Human gate | Overall |
|---|---|---|---|---|---|---|---|---|---|
| US1 | PASS | PASS | PASS | PASS | PASS | N/A — FIXTURES | PASS — CLAUDE OPUS APPROVED | N/A | MVP PASS |
| US2 | PASS | PASS | PASS | PASS | PASS | PASS — LOCAL/PACKAGED, NO LIVE PROVIDER CALL | PASS — CLAUDE SONNET APPROVED | N/A | US2 PASS |
| US3 | PASS — SERVICE POLICY | PASS | PASS | PASS | PASS | PASS — EXACT CODEX/CLAUDE MANUAL-ONLY PROOFS | PASS — OPENAI SOL APPROVED | N/A | US3 PASS |
| US4 | PASS | PASS | PASS | PASS | PASS | N/A — FIXTURES | PASS — CLAUDE OPUS APPROVED | PASS — PR #10 OWNER APPROVED | US4 PASS |
| US5 | PASS | PASS | PASS | PASS | PASS | PASS — DETERMINISTIC SESSION BRIDGE | PASS — CLAUDE OPUS APPROVED | N/A | US5 PASS |
| US6 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | CONFIRM IMPORT | NOT READY |
| US7 | PENDING | PENDING | PENDING | PENDING | PENDING | N/A | PENDING | CONFIRM SAVE/EXPORT | NOT READY |
| US8 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | NOT READY |

## Historical release gates (US5 closure)

| Gate | Local status | Hosted/external status | Evidence or blocker |
|---|---|---|---|
| Formatting | PASS | N/A | Fresh full `pnpm format` after US5 final remediation. |
| Lint | PASS | N/A | Fresh full `pnpm lint` after US5 final remediation. |
| Rust format/check/test | PASS | N/A | Format, clippy with warnings denied, 17 supervisor tests, and 8 bridge tests passed. |
| Typecheck | PASS | N/A | Fresh full `pnpm typecheck` after US5 final remediation. |
| Unit tests | PASS | N/A | Full cross-project Vitest: 42 files and 380 tests passed with 10 intentional skips. |
| Contract tests | PASS | N/A | Included in the fresh full Vitest pass; focused US5 provider/desktop boundaries are green. |
| Desktop build | PASS | N/A | Main, preload, and renderer built. |
| Windows supervision proof | PASS — LOCAL X64 | N/A | Exact real native bridge PID containment proof passes; full serialized integration: 12 files, 42 passed, 1 intentional skip. |
| Windows integration | US1 + US2 + US3 FIXTURE SLICES PASS | N/A | Focused coordination delivery 13/13, including exact-version fixture safe points, real named-pipe EOF degradation, recipient isolation, and fail-closed power/provider paths. |
| E2E | US1–US5 + LAUNCH-POLICY SLICES PASS | N/A | Fresh full Playwright passed 21/21, including four shared-memory journeys. |
| Packaged installed artifact | PASS — LOCAL X64, UNSIGNED | N/A | Provider smoke 3/3 and installed-app acceptance 5/5; bridge present in ASAR-unpacked signed-path location, but no signing certificate was configured. |
| Codex live provider | PASS — MANUAL-ONLY | N/A | Authenticated exact Codex CLI 0.150.1 proof found no pending-draft/editor safety field; automatic presentation remains disabled. |
| Claude live provider | PASS — MANUAL-ONLY | N/A | Authenticated exact Claude Code 2.1.251 Stop-hook proof found no pending-draft/editor safety field; automatic presentation remains disabled. |
| Hosted CI | PENDING — US5 | PASS — BASE PR #10 | PR #10 checks cover the merged base only; US5 hosted checks require its new PR. |
| Owner release approval | PENDING | PENDING | Requires exact artifact/commit and all required gates. |

## Review findings and decisions

Append findings with story, reviewer/model or human role, severity, evidence, disposition, and
verification. Never record secrets, terminal transcripts, hidden prompts, or raw provider output.

| Story | Reviewer | Severity | Finding/evidence | Disposition | Verification |
|---|---|---|---|---|---|
| US1 | Claude `claude-opus-5` / `high` | P1 | Recipient-session teardown resolved every pending control as applied, so a host/session exit during dispatch could falsely mark an unacknowledged handoff delivered. | Pending controls now carry a boolean result; only matching `host.controlApplied` resolves true and teardown resolves false. | Recipient-only failure regression changed from `applied` red to `unknown`/`manual_actionable` green; Claude re-review resolved the finding. |
| US1 | Claude `claude-opus-5` / `high` | P2 | The durable repository did not call the coordination domain transition policy and allowed divergent `failed -> presenting` and `failed -> cancelled` transitions. | Persistence now depends on `@threadhelm/domain` and delegates prepare, dispatch, completion, cancellation, retarget, attempt, and outcome transitions to domain policy. | Persistence regression changed from red to green; Claude re-review resolved the finding. |
| US1 | Claude `claude-opus-5` / `high` | P3 | Confirmation returns authored content outside the strict detail/preview/presentation surfaces; duplicate identity comparison omits kind/origin/reply fields; later non-open-conversation retarget needs an explicit guard. | Non-blocking observations retained for a later hardening slice before US2/US4 expands those paths. | OPEN — does not block the explicit US1 MVP approval. |
| US1 | Claude `claude-opus-5` / `high` | P3 | Four fixed event summaries bypass the centralized safe-summary template; activity snapshot uses an unchecked cast; preview defers some conversation/quota failures until confirmation. | Non-blocking observations retained for later contract/sanitization UX hardening. | OPEN — does not block the explicit US1 MVP approval. |
| US1 | OpenAI `gpt-5.6-luna` / `medium` (provisional, not a Claude substitute) | P1 | Attempt became durable `dispatching` only after terminal submission. | Added a `beforeSubmit` control hook; durable transition now commits before `postMessage`, with no-write cleanup on failure. | Unit assertion observes `dispatching` inside host submission; Windows 6/6. |
| US1 | OpenAI `gpt-5.6-luna` / `medium` | P1 | Broad list IPC exposed purpose/body. | Added strict `HandoffSummaryView` omitting both fields and strips explicit-response content before general renderer state. | Contract rejects content in summary; contract 131/131. |
| US1 | OpenAI `gpt-5.6-luna` / `medium` | P1 | Preview confirmation checked workspace IDs but not current approval/native identity. | Production disclosure validator now reopens approved paths and compares native identity at preview, confirmation, presentation, and retarget. | Identity-drift and revoked-approval unit tests pass. |
| US1 | OpenAI `gpt-5.6-luna` / `medium` | P2 | Invalid handoff states could receive presentation disclosures. | Presentation and retarget disclosure entry points now enforce allowed states before issuing a token. | Cancelled-state unit proof passes. |
| US1 | OpenAI `gpt-5.6-luna` / `medium` | P2 | Presentation token revalidation omitted activity evidence. | Confirmation now matches activity state, evidence kind, and observation timestamp. | Activity-drift token test passes. |
| US1 | OpenAI `gpt-5.6-luna` / `medium` | P1 | Reviewer snapshot saw T022–T031 unchecked. | T022–T030 are checked only after their final gates; T031 intentionally remains open for Claude. | `tasks.md` reconciled. |
| US2 | Claude `claude-sonnet-5` / `high` | P1 | Renderer IPC exposed `coordination.reportOutcome`; the service reloaded the handoff and passed its stored recipient back into the repository check, making the identity check tautological and allowing renderer-forged provider outcomes. | Removed the renderer contract, coordinator handler, preload exposure, and service method. Provider outcomes are accepted only through the authenticated session bridge; deterministic E2E uses an explicitly test-only hook that requires a live recipient session. | Focused desktop IPC/bridge contracts pass 21/21 and assert the renderer operation is absent; Claude re-review marked fixed. |
| US2 | Claude `claude-sonnet-5` / `high` | P2 | Packaging smoke proved bridge presence but not that the real native bridge process inherits the provider session Job Object. | The fixture provider now spawns the actual Rust bridge with a private session config and publishes the exact child PID; the architecture proof calls native `verifyProcessInJob` for that PID and proves terminate/handle-close cleanup. | Windows architecture proof passes 3/3, including exact real-bridge PID containment; Claude re-review marked fixed. |
| US2 | Claude `claude-sonnet-5` / `high` | P3 | The anti-impersonation test claimed a forged sender attempt but never submitted a sender field. | Test now submits `senderSessionId` as an unknown parameter and proves strict rejection before verifying authenticated sender derivation on a valid request. | Focused provider bridge contract passes; Claude re-review marked fixed. |
| US5 | Claude `claude-opus-5` / `high` | P1 | A resolution revision created through the UI cited only its own entry while persistence required citations to both competing entries, making conflict resolution unreachable. | Conflict views now expose both content-free entry IDs; supersession prioritizes both mandatory memory citations; the actual UI resolves a provider-created conflict. | Expanded memory E2E conflict journey passes end to end. |
| US5 | Claude `claude-opus-5` / `high` | P2 | Contested supersession became clean active content before conflict resolution; revoked scopes could supersede; expiry had no production input/caller; retained-byte quota was tracked but unenforced. | Contested state and conflict counts follow the entry lineage until cited resolution; supersede revalidates approval; publication/proposal expiry is explicit and applied on reads; 64 MiB retained bytes are enforced transactionally. | Persistence/contract remediation changed from six RED failures to 18/18 GREEN; production expiry and conflict paths pass E2E. |
| US5 | Claude `claude-opus-5` / `high` | P3 | Contract-valid null scopes failed equality; renderer lacked pagination and contested opt-in; competing resolution events, modal focus/Escape, and supersede-state resync were incomplete. | Scope comparison uses canonical keys; renderer exposes active-only default plus load-more; main emits every changed entry; native modal behavior and revision-state resync are explicit. | Typecheck/lint pass and four keyboard E2E journeys cover each corrected renderer path. |
| US5 | Claude `claude-opus-5` / `high` | P2 | First remediation unconditionally activated any cited resolution revision, allowing a retracted current or stale superseded revision to become searchable and desynchronize entry/current state. | Resolution now requires the entry's exact current revision in `contested` state; a partial unique index permits only one active/contested revision per entry. | Retraction and two-supersession stale-resolution regressions fail before the fix and pass after it without FTS resurrection. |
| US5 | Claude `claude-opus-5` / `high` | P3 | A load-more cursor remained visible after query/scope/contested-filter changes, then failed its bound query hash. | Every cursor-bound input change clears results, detail, and `nextCursor`; a fresh search is explicit. | Pagination E2E toggles contested state, proves load-more disappears, then retrieves 21 results after a fresh search. |

### User Story 2 Implementation & Test Evidence (T033–T047)

- **T033 Contract Suite** (`tests/contract/provider-coordination.test.ts`):
  - Proved initial RED (missing `apps/desktop/src/main/coordination/bridge.js`).
  - Final verified GREEN (7/7 tests passing): private config lifecycle and a real Windows named-pipe request, session credential issuance/auth, JSON-RPC 2.0 framing and 32 KiB rejection, a submitted forged-sender field rejected by strict parsing, four mailbox tools, 20/min rate limiting, and safe bridge disconnect degradation.
- **T034 Windows Recovery & Durable History** (`tests/integration/windows/coordination-recovery.test.ts`):
  - Proved initial RED on missing repository operations.
  - Final verified GREEN (6/6 tests passing): restart without resend, acknowledgement/outcome separation, delivered-parent causal replies, stale/non-recipient rejection, keyset pagination, retained-byte accounting, and inactive-content deletion with lifecycle preservation.
- **T035 E2E Scenarios** (`tests/e2e/coordination.spec.ts`):
  - Final full file passed 5/5 scenarios, including auditable conversation timeline, explicit bounded detail loading, and delivered/completed content deletion confirmation.
- **T036 & T037 Rust Coordination Bridge Binary** (`native/windows-supervisor/src/bin/threadhelm-coordination-bridge.rs`):
  - Proved initial RED on missing handler methods.
  - Implemented bounded stdio MCP JSON-RPC 2.0 to named pipe bridge with 32 KiB max frame enforcement, structured stderr log redaction (`{"event":..., "bytes":...}` without secrets/content), and safe disconnect handling.
  - Final GREEN via the bridge binary target (8/8 unit tests); Rust formatting, warnings-denied clippy, and release build passed.
- **T038, T039, T040 Provider Adapter Contracts & Per-Session Launch Config**:
  - Declared `bridgeConfiguration: 'session_scoped_stdio_mcp'` and capabilities in `packages/providers/src/adapter.ts`.
  - Implemented ephemeral Codex `--config mcp_servers...` overrides and Claude `--mcp-config` arguments in `packages/providers/src/codex.ts` and `packages/providers/src/claude-code.ts` without touching user, project, or global configuration files.
  - Verified GREEN with `pnpm exec vitest run --project contract tests/contract/provider-adapter.test.ts` (43/43 tests passing).
- **T041 Desktop Main Bridge Manager** (`apps/desktop/src/main/coordination/bridge.ts`):
  - Implemented session credential issuance with cryptographic tokens, named-pipe authentication, method dispatch, and sliding-window rate limiting.
- **T042 Durable Coordination Repository & Main Service** (`packages/persistence/src/repositories/coordination.ts`, `apps/desktop/src/main/coordination/service.ts`):
  - Implemented `acknowledgeHandoff`, `createBridgeReply` (parent-derived recipient, incremented reply depth, authority hold), `reportWorkOutcome`, `updateConversationState`, `deleteConversationContent` (inactive conversations only, zeroing content while preserving metadata), and pagination (`listConversations`, `getConversationDetail`, `listPendingHandoffsForSession`).
- **T043 Strict Desktop IPC Operations & Preload Bridge** (`packages/contracts/src/index.ts`, `apps/desktop/src/main/ipc/router.ts`, `apps/desktop/src/preload/index.ts`, `apps/desktop/src/main/coordinator.ts`):
  - Extended typed renderer operations (`coordination.listConversations`, `coordination.getConversation`, `coordination.pauseConversation`, `coordination.requestContentDeletion`, `coordination.confirmContentDeletion`) and events (`coordination.conversationChanged`, `coordination.bridgeChanged`). Provider outcome reporting is intentionally bridge-only and absent from renderer IPC.
- **T044 & T045 Attributed Conversation Timeline & Deletion UI** (`apps/desktop/src/renderer/features/coordination/ConversationView.tsx`, `apps/desktop/src/renderer/features/coordination/HandoffDisclosures.tsx`, `apps/desktop/src/renderer/App.tsx`):
  - Built attributed conversation timeline displaying separate transport state and work outcome badges, bounded detail loading, pause controls, and `DeleteConversationDialog` disclosure.
- **T046 Packaging & Signing Integration** (`apps/desktop/forge.config.ts`, `apps/desktop/electron.vite.config.ts`, `native/windows-supervisor/package.json`):
  - Configured ASAR unpack for `threadhelm-coordination-bridge.exe` keeping it beside native supervisor binary within the signed distribution.
  - Proved the exact real bridge PID inherits the provider session Job Object and is terminated with that scope; Windows architecture proof passes 3/3.
- **T047 Acceptance Smoke Proof** (`tests/acceptance/provider-coordination-smoke.test.ts`):
  - Verified GREEN (3/3 tests passing): bridge discovery, isolated launch configs, full structured lifecycle (credential, pending list, ack, reply, outcome, disconnect, revoke).

### User Story 3 Local Implementation & Test Evidence (T050–T059 partial)

- **T050/T053 provider-neutral contract**: strict content-free lifecycle evidence includes only
  authenticated session/provider/version, bounded event/turn IDs, event category, timestamp,
  safe-point boolean, and explicit pending-draft safety. Unknown fields and raw hook/transcript data
  are rejected. Capabilities name exact proved versions instead of inheriting the broad CLI probe range.
- **T054/T055 built-in provider status**: exact installed proofs ran independently for Claude Code
  2.1.251 and Codex CLI 0.150.1. Both expose structured completion events but neither exposes the
  interactive TUI's pending-draft/editor state. Both therefore retain empty automatic-version sets,
  `inputSafety: unknown`, null parsers, and `manual_only`; raw message/transcript fields are rejected.
- **T056 bridge evidence boundary**: the session credential authenticates evidence; main rejects
  cross-session/provider/version drift, stale/future/pre-power events, duplicate event IDs, unsupported
  categories, and unproved draft safety. Only the content-free activity category/timestamp reaches
  session persistence/events.
- **T057 one-item presentation**: one accepted deterministic fixture safe point may submit only the
  oldest queued handoff through the existing ordered host-control path. It revalidates live session,
  workspace identity, exact adapter/version, body bounds, and attempt invariants; it resets activity
  afterward and cannot infer readiness from output, silence, timers, CPU, process, or connection state.
- **T058 runtime recovery**: lock, suspend, resume, unlock, bridge disconnect, provider failure, and
  restart invalidate volatile lifecycle evidence without launching, replaying, resending, or changing
  another session. Existing ambiguous-dispatch recovery remains `unknown`/`manual_actionable`.
- **T059 deterministic acceptance**: separate Codex/Claude fixture cases prove exact-version isolation,
  one safe point, pending-draft downgrade, power invalidation, and credential cleanup. These fixtures
  complement rather than substitute for the exact installed-provider proofs recorded by T054/T055.
- **T060 completed gate**: exact installed Codex and Claude proofs keep both providers explicitly
  manual-only; deterministic provider/Windows/E2E slices pass; and the independent OpenAI Sol fault
  review reports no remaining P0–P3 findings. Approval is limited to US3 and does not include the P4
  automatic-continuation/opt-in work beginning at T061.

### User Story 4 Local Implementation & Test Evidence (T061–T070 partial)

- **T061 model gate**: Codex CLI 0.150.1 returned exact successful read-only probes for
  `gpt-5.6-sol`/`max` and fallback `gpt-5.6-terra`/`max`; Claude Code 2.1.251 returned an exact
  successful no-tools probe for canonical `claude-opus-5`/`xhigh`. Antigravity 1.1.22 lists the
  optional `gemini-3.1-pro-high` reviewer. Human-owner availability is established by the owner
  starting this sequence; final acceptance remains pending.
- **T062/T064 domain policy**: the initial focused run failed 6/6 new cases because
  `evaluateAutomaticContinuation` did not exist. The final focused domain/persistence/service run
  passed 41/41. It proves terminal-state precedence, specific authority/conflict reasons even when
  opt-in is off, depth eight/ninth hold, third exact equivalent inside the bounded window, held-kind
  loop detection, consecutive-failure reset after success, allowed/held kinds, and closed-state
  finality.
- **T063/T067 strict desktop contract**: the initial focused contract run failed 3 new cases on
  missing schemas and operations. The final desktop/provider contract run passed 30/30, including
  one-use auto-continue disclosure, content-free escalation views, exact dispositions, structured
  conflict propagation, and recoverable MCP tool errors that do not revoke the session credential.
- **T065 transactional persistence**: the initial focused persistence run failed 3 new cases on
  missing opt-in/escalation methods and absent third-failure pause. The final suite proves rollback
  when escalation insertion fails, the partial unique one-open-escalation invariant, specific held
  late arrivals, closed conversations rejecting presentation/reopen, queued siblings becoming held
  on pause, late post-deletion content remaining deleted, and exact once-only escalation resolution.
- **T066/T068 E2E**: after the initial expected failures on missing named operations and UI, the
  final built-desktop slice passed 2/2: a reviewed bounded continuation delivers exactly one eligible
  provider reply, and an authority escalation closes the conversation while a later provider message
  remains held with `CONVERSATION_CLOSED`.
- **T069 Windows isolation**: the final sequential Windows recovery slice passed 10/10, including
  exact-repeat loop, three-failure, conflict, authority, closed-arrival, and cross-conversation
  isolation cases.
- **Rust bridge**: `cargo fmt --check` passed and the coordination-bridge binary tests passed 8/8
  after adding required structured conflict and response-expectation fields.
- **Static/build gates**: Prettier, ESLint, TypeScript project build, and Electron desktop build all
  passed on the corrected implementation.
- **Claude adversarial review**: `claude-opus-5`/`xhigh` reviewed the current repository with
  read-only tools. Its P1 paused-sibling presentation path was reproduced and fixed by holding queued
  and manual-actionable siblings transactionally and checking open conversation state at disclosure,
  confirmation, repository attempt preparation, and automatic safe-point presentation. Its bounded
  P2 findings were also corrected where in scope: tool-call errors return safe MCP errors without
  revoking a valid bridge, escalation/conversation changes are emitted live, post-deletion late
  arrivals remain content-free, deleted handoffs cannot be retargeted, response expectations are
  schema-aligned, and the repeat window uses one documented newest-first ordering.
- **Open reviewer/design disposition**: `redirect` currently records an exact redirected disposition
  but, under the approved invariant that no third participant enters a reply conversation, the only
  non-sender participant is already the current recipient. Making redirect change the target safely
  requires an explicit contract decision: fork the held work into a new two-party conversation with
  auditable linkage, or expand the participant model. This is not being guessed in implementation.
  T070 and human acceptance remain open until the owner selects that interpretation or explicitly
  accepts the bounded same-participant disposition.
- **Optional review**: Antigravity review was not consumed because it is optional and the independent
  Claude review already identified the remaining product-contract decision. No result is claimed.
- **T070 merged acceptance**: the owner explicitly approved and merged PR #10 at merge commit
  `d58379d` after every hosted Windows and CodeQL check passed. Fresh PR-head evidence at `79247d3`
  was: full Vitest 347 passed/10 skipped, TypeScript/Prettier/ESLint clean, Rust format/Clippy clean,
  Rust tests 25/25, desktop build pass, and Playwright 17/17. The E2E startup-readiness race found by
  the first merge-gate run was reproduced, fixed by waiting for the renderer's initial versioned
  state before fixture events, and passed five repeated focused runs before the full green suite.
- **Redirect acceptance boundary**: owner approval covers the exact bounded disposition shipped in
  PR #10. It does not claim that redirect already forks work to a different static persona. That
  meaningful retarget/fork behavior remains deferred to the reviewed roster/supervisor sequence and
  must preserve a new linked two-party conversation rather than silently changing participants.

### US6 reviewed roster implementation evidence

- **T099-T100 main/IPC**: bounded file-handle selection, 64 KiB reads, strict parsing, SHA-256
  digest-bound one-use preview tokens, changed-file recheck, compatibility evaluation, transactional
  confirmation/deletion, content-free events, and generic least-privilege preload routing are green.
  Focused contract tests passed 17/17 and Windows import tests passed 6/6; confirmation creates no
  session, workspace approval, worktree, provider setting, role, tool, or budget authority.
- **T101-T103 renderer**: Claude Sonnet 5/high produced the bounded renderer slice using streamed
  output and `bypassPermissions`; it reached the 30-turn cap at USD 1.476916 after writing the UI.
  Independent local correction supplied required empty IPC request arguments. Typecheck, desktop
  build, and all five keyboard-only Playwright roster journeys then passed. The UI is compact,
  text-only, and has no avatar, image, video, canvas, or animation dependency.
- **T104 provider disclosure seam**: both built-in adapters now return a main-owned, process-only
  disclosure for exact stable profile/revision IDs, effective provider/model/effort, requested versus
  effective isolation and token budget, effective elapsed/concurrency budget, closed tool registry,
  and exact workspace. Unsafe expansion and unsatisfied required isolation fail closed; profile IDs
  are not placed in provider argv and neither adapter adds a settings mutation. Provider adapter
  contract tests passed 47/47.
- **T105 exact Downloads acceptance**: opt-in acceptance imported the ten user-selected files in
  place and logged only basenames/digests/results. Portable provider `claude` was explicitly resolved
  to runtime adapter `claude-code` without rewriting the stored request; lowercase hyphenated
  capability labels remained inert data. Result: 10/10 PASS, four Opus/six Sonnet, eight isolated/two
  non-isolated, every requested token cap exactly 2,000,000, every compatibility result compatible,
  and zero sessions/workspaces created.

| Basename | SHA-256 | Result |
|---|---|---|
| `black-panther-commerce-engineer.hire.json` | `7cf5af78041346cb91eabcc1d485900097ad2c0a1d1cf4252fa5b38d9de49214` | PASS |
| `captain-america-pr-deployment-gatekeeper.hire.json` | `17a94e34540a37cc43b49a0df2c85af5da4851584a9c872475d5ef3ae189373b` | PASS |
| `doctor-strange-square-event-sentinel.hire.json` | `2a0aa5268a3cc413d3598a5b9e660866a89ab7d7ca2bec7bc2462dea27345b3a` | PASS |
| `maria-hill-issue-triage.hire.json` | `88d8b9677c564e530c6a306878d62d08299e0c16a1e25a775e63863b0768eb31` | PASS |
| `nick-fury-release-commander.hire.json` | `a0be866432d56d47bce9123425a37ff8dee0ee5cf1fb99cae0241dc919248521` | PASS |
| `she-hulk-spec-review-counsel.hire.json` | `17db7fa89b4403ecbd6e1aac66a0be62e86890e9539da3cb5728c423862eb7cb` | PASS |
| `shuri-ui-ux.hire.json` | `932ea6d8870af3fe9774bf310d457220febe306363032876016de671737f64c0` | PASS |
| `spider-man-quality-engineer.hire.json` | `18a234d108fccdce28cee2a12882431c2f1952eb3d1697b5aaca390d0e6c38e7` | PASS |
| `vision-authority-flags-architect.hire.json` | `9b1cee77bdc0a4b740a7ad07709a161ca2a41eff0ceef3849d3d3f9838a86515` | PASS |
| `war-machine-devops-operator.hire.json` | `332ca412f71ada3f8238686836d0a76efc40bff85b2973fac20b457c4a3f2e6e` | PASS |

- **T106 independent review and final verification**: the bypass-authorized, read-only OpenAI Sol
  review found one P1 in same-digest compatibility reconciliation: a previously compatible profile
  could remain active after provider/model availability changed. The repository now refreshes only
  derived compatibility metadata, disables every incompatible current revision, rejects enabling it,
  and preserves the user's disabled state if compatibility later returns. It also requires an inactive
  profile before deletion. Existing schema-v3 databases now receive the additive profile tables
  transactionally instead of being skipped by the unchanged version number. Regression tests cover
  same-digest compatible-to-unavailable-to-compatible, same-version v3 extension,
  new incompatible revisions, stale revisions, mission pins, and disable-before-delete. Final exits:
  ESLint 0; TypeScript 0; Prettier/whitespace 0; full unit 189/189; full contract 182/182;
  focused Windows 6/6; keyboard Playwright 5/5; exact Downloads acceptance 1/1; desktop main,
  preload, and renderer build 0. Stable profile/revision UUIDs remain independent of mutable names;
  content-free events contain no goal/persona text or source path; import launches and grants nothing.

### US7 persistence completion — T109/T115/T116 (2026-08-30)

- Resumed the existing dirty checkout at `659e59b` after checking the feature selector,
  requirements checklist (16/16), task ledger, and fetched `origin/main`. Created
  `codex/us7-template-persistence` without discarding, committing, or staging prior changes.
  Existing launch-policy, domain/fixture, roadmap, and specification edits were preserved.
- **T109:** Expanded the two foundation tests into 17 real SQLite cases. Initial new coverage
  failed 11/11 for missing lifecycle operations and guards; the legacy-v3 case also failed before
  implementation. Later source/discovery/incomplete-field additions failed 3/16; review regressions
  failed 2/2 before their fixes. Final focused run passed 17/17. Coverage includes disk close/reopen,
  copied template and reviewed-profile provenance, stale draft/revision denial, bundled immutability,
  user revisions and duplication, enable/disable/delete, 100 user templates and 20 open drafts,
  content scrubbing, immutable completion, strict field ownership, literal variables, bounded
  content-free discovery, caller-transaction rollback, and legacy migration rollback/retry.
- **T115:** Added the transactional `agent_template_storage_v1` extension through the existing
  `CURRENT_SCHEMA_EXTENSIONS` runner; no separate change to `migrate.ts` was needed. The upgrade
  preserves earlier v3 template/revision/draft IDs, recovers initial fields from pinned source
  revisions, adds version/step/field/variable/issue/profile-provenance storage, and rebuilds dependent
  tables without disabling foreign keys. Failed upgrades roll back and may be retried. Migration
  tests verify repeated application and an empty foreign-key check. The existing complete-table
  inventory assertion was updated for the four new tables after its expected mismatch.
- **T116:** Repository operations now enforce exact draft versions and template revisions,
  active/current seed eligibility, quota checks inside write transactions, read-only bundled
  revisions, and independent local duplicate identities. Completion remains a repository operation
  that the later main service must combine transactionally with profile creation or export intent;
  this slice does not implement confirmation tokens, export effects, IPC, or renderer controls.
- **Digest decision:** Manifest SHA-256 remains exact content evidence, while revision UUID and
  `(template_id, revision)` bind identity. The digest index is scoped to a template rather than
  globally unique: distinct local copies must be allowed to contain identical manifest bytes.
  This reconciles the required duplicate operation with the earlier data-model global-uniqueness
  wording. It grants no runtime identity or authority based on content equality.
- **Independent OpenAI review:** A read-only local subagent reproduced two P2 findings: final-schema
  trimming rejected/altered intermediate draft text, and aggregate Unicode defaults could exceed
  autosave bounds. Failing-first regressions now prove exact incomplete text recovery, strict final
  validation, aggregate UTF-8 declaration bounds, and default-value revalidation. Re-review found no
  remaining concrete issue within T109/T115/T116 and independently passed 17/17 tests. This is not
  the separately approval-gated Claude review. No Claude or Antigravity invocation occurred.

| Local command | Final exit | Evidence |
|---|---:|---|
| `pnpm exec vitest run --project unit tests/unit/persistence/agent-templates.test.ts` | 0 | 17/17 passed |
| `pnpm test:unit` | 0 | 24 files, 219/219 passed after updating the schema inventory assertion |
| `pnpm test:contract` | 0 | 10 files, 198/198 passed; existing contracts only, not the pending US7 IPC suite |
| `pnpm typecheck` | 0 | Complete TypeScript project build passed |
| `pnpm lint` | 0 | Complete ESLint pass after correcting the type-only test import |
| Scoped `pnpm exec prettier --check` | 0 | Repository, schema, template persistence tests, and migration tests passed |
| `pnpm desktop:build` | 0 | Electron main, preload, and renderer built |
| `pnpm exec vitest run --project integration tests/integration/windows/agent-profile-import.test.ts` | 0 | Existing Windows import regressions 6/6 passed |
| `pnpm exec playwright test tests/e2e/agent-roster.spec.ts` | 0 | Existing built-Electron keyboard roster regressions 5/5 passed |
| `git diff --check` | 0 | No whitespace errors |

**Status at the end of the persistence-only slice:** T110–T112 and T117–T125 were open. The wizard service, exact review/export tokens,
atomic export, named IPC/preload operations, wizard/template UI, launch-disclosure integration,
US7-specific Windows/E2E acceptance, and separately authorized verifier gate are not complete.
No hosted CI, installed-package, live-provider, US8, merge, or release result is claimed.

### US7 wizard, template library, and export — T110–T125 (2026-08-30)

- **Scope and ownership:** Continued the same dirty checkout and branch on the owner's instruction
  to complete all US7. OpenAI Terra at high implemented the main/IPC/export slice; the controller
  implemented the renderer and desktop journeys; a separate OpenAI Sol at high reviewed backend
  safety and specification compliance. No commit, push, merge, provider model run, Claude review,
  or Antigravity run is included in this evidence.
- **Main authority:** Named wizard/template operations and generated preload namespaces own bounded
  drafts, exact manifest reviews, profile-save delegation, native export-target selection, token-bound
  confirmations, versioned local templates, and content-free change events. List responses omit goals,
  field values, variables, JSON, and full export paths; these require explicit detail/preview calls.
  Profile creation and draft completion share a database transaction.
- **Renderer:** Six keyboard-accessible steps provide blank, generic, local-template, and reviewed-profile
  starts; owned-field errors; debounced local autosave; Back, resume, cancel and delete; exact JSON and
  digest review; compatibility warnings; profile save, template save/revision, and explicit export
  confirmation. The library offers detail/provenance, duplicate, disable/enable, and guarded deletion.
  Native labels are explicit so option text and textarea contents cannot obscure accessible names.
  The interface uses text/forms only, without character art, graphics, animation, or idle polling.
- **Bounds and schema decisions:** The exact existing `HireManifestV1` parser remains authoritative:
  16 capability labels, not the earlier planning-table value of 64. Drafts preserve bounded incomplete
  text, but completion never weakens final validation. Templates are limited to 100 active local
  templates and 32 revisions each, 20 open drafts and one MiB combined draft storage, and 16 declared
  literal variables of at most 256 Unicode scalars. Existing schema string bounds remain unchanged.
  Because the portable schema requires provider/model values, the generic seeds retain explicit
  Codex/Terra requests; their goals and capabilities remain generic and confer no provider authority.
  Local theme/style uses ordinary name/description text, not a new portable schema field.
- **T122 launch handoff:** US7 never calls `sessions.previewLaunch` or constructs a launch descriptor.
  The existing `sessions/preview.ts`, `sessions/launch-policy.ts`, and provider `adapter.ts` continue
  to resolve model/effort, permission policy, tools, workspace identity, isolation and resource limits.
  Wizard review states that these are separately resolved at launch. The shared strict schema rejects
  permission/effort/tools/workspace/mission-role fields. Saving, exporting, copying, or renaming a
  persona does not grant launch authority; the existing launch dialog retains its separate folder
  boundary confirmation.
- **Failing-first and review evidence:** Initial desktop tests failed on the missing creation control,
  then on ambiguous select/textarea labels. A new blank-start journey failed final review before
  default schema identity/isolation were fixed. The first broad unit run caught the new export-intent
  table missing from the migration inventory; the first broad contract run caught degraded-storage
  service initialization (three existing cases failed). Independent backend review additionally
  identified an absent-target overwrite race, prepared-intent recovery gap, placeholder loss when
  saving templates, and incomplete field-error attribution. Fixes and regression evidence are recorded
  below; earlier green focused runs did not establish those wider guarantees.
- **T123 local-themed acceptance:** The built-Electron keyboard journey imports the reviewed Spider-Man
  fixture through the existing import confirmation, starts a draft from that exact reviewed profile,
  saves `Spider-Man local quality` as a user template, checks reviewed-profile provenance, disables and
  enables it, duplicates it, and deletes the duplicate. Six bundled starters remain separate, generic,
  and free of Marvel names or graphics. The controller inspected the resulting desktop screenshot
  (`test-results/us7-local-template-acceptance.png`). This is agent-driven automated desktop acceptance,
  not a claim that the owner performed human acceptance. The manual recipe is in quickstart section 12.

**T125 exact bundled inventory:** Version 1; SHA-256 of the exact canonical UTF-8 JSON (two-space
indentation and trailing LF), recomputed from the shipped fixtures. All six use one narrow routing
label, a bounded goal, no literal variables, no executable fields, and no project/Marvel content.

| Template key | Version | SHA-256 | UTF-8 bytes |
|---|---:|---|---:|
| investigator | 1 | `a793a98b6135999829d00acdd38affac0c8e1e01e1e75fa394bab4f5c246cf35` | 327 |
| implementer | 1 | `c90598a87ddb95e2946c701800c732f28fd7ed239571d0c64a7f6fb457e81818` | 335 |
| reviewer | 1 | `cdd1f32162f0c68576645df08ad0df3d82c81811757b5b5e253c9ae2c63d97f8` | 327 |
| quality | 1 | `f9b40a7698718c434c5bd2bf11441cfa8e857152911c69d71dd8626eeb894436` | 334 |
| documentation | 1 | `3347975aa9a0fb5ee87fa67ca3add07138a12acd5a4b40b4d796d006627c5d51` | 345 |
| release-gate | 1 | `0685e4888afe1d0b326c34f7b93253e29509b36a11c6f74c0ae0a3e3882e8c2a` | 339 |

- **Owner production-content correction:** The owner explicitly required Marvel personas to remain
  private custom content, excluded from production releases. A scan found that the general test-fixture
  barrel had embedded `MARVEL_ROSTER_FIXTURES` and persona names in `out/main/index.cjs`, despite
  generic visible starters. The desktop now uses a narrow `@threadhelm/test-fixtures/desktop` entry;
  deterministic runtime helpers no longer import the private roster barrel. Vite rejects private
  fixture modules and persona content in generated chunks/assets; Forge scans copied output before
  packaging, including stale chunks. Two failing-first guard tests now pass. A rebuilt output scan
  passed with no private persona content. Custom local import behavior remains covered separately.
  This verifies built output and the packaging guard; no new signed/installed release was produced.

| Final local command / gate | Exit | Result |
|---|---:|---|
| `pnpm test:unit` | 0 | 25 files; 227/227 passed, including production-content guard cases |
| `pnpm test:contract` | 0 | 11 files; 208/208 passed, including ten wizard/template cases |
| `pnpm typecheck` | 0 | Full TypeScript project build, including build/package guards |
| `pnpm lint` | 0 | Full ESLint pass |
| Prettier over changed TypeScript/TSX/CSS/JSON files | 0 | All matched files passed |
| `pnpm desktop:build` | 0 | Main, preload, renderer; private-fixture graph/content guard passed |
| `assertProductionPersonaBoundary("apps/desktop/out")` | 0 | Recursive built-output scan passed; no private persona content |
| Windows wizard/import/permission integration slices | 0 | 15/15 passed; seven wizard/export, six import, two permission-policy |
| Built-Electron wizard/roster/launch Playwright slices | 0 | 13/13 passed; seven wizard, five roster, one launch journey |
| `git diff --check` | 0 | No whitespace errors |

Backend review fixes retain edited literal placeholders, identify missing/invalid values by manifest
field even for long variable names, reject invalid capability labels before Next, recover prepared
and writing export intents without replay, and classify installed-file cleanup failures as unknown.
Completed drafts remain readable after their user template is deleted. Missing targets use an atomic
no-clobber hard-link installation; filesystems without that primitive fail safely. Existing targets
still require an explicit overwrite review and changed-target checks. Scoped regression evidence is
included in the final suites above.

**Final independent review: PASS.** A whole-US7 OpenAI Sol review raised two final P2 findings:
literal expansion needed to gate its owned step with exact field errors, and copied templates needed
to survive deletion of a historical provenance profile. The consolidated fix validates expansion with
the shared manifest rules, exposes variable inputs before Identity advances, and distinguishes live
direct profile copying from historical copied provenance. Post-fix contract/persistence regressions
and the identity-variable desktop journey passed. The scoped re-review found both findings addressed,
with no new important regression; specification compliance and code quality/safety both passed.

**US7 complete:** T107–T125 are checked in the task ledger. No hosted CI, signed/installed artifact,
live-provider run, Claude review, Antigravity run, US8 completion, merge, or release approval is claimed.
The owner's private-persona release preference was also saved to the permitted memory update folder.

## Feature 002 remainder — US8 execution and cross-cutting work (2026-08-30)

- **T126 implementation assignment:** resumed `codex/us7-template-persistence` at `659e59b`,
  fetched/pruned origin, retained all pre-existing dirty US7/specification changes, and verified
  the active feature selector and 16/16 requirements checklist. No extension hooks are configured.
  Current desktop inventory exposes OpenAI `gpt-5.6-sol`/`max` and `gpt-5.6-terra`/`max`;
  Sol/max is assigned the authority/concurrency backend. The owner requested the rest of Feature002;
  final authority acceptance remains a separate T149 gate.
- **Current independent reviewer availability:** Claude Code `2.1.251` reports authenticated
  `claude.ai`, `firstParty`, `max`. A tool-free, strict-empty-MCP, hooks-disabled, no-session-persistence
  `claude-opus-5`/`xhigh` probe returned `US8_REVIEWER_AVAILABLE`, exit0, reported cost USD0.048978.
  Model usage included canonical `claude-opus-5` and CLI auxiliary Haiku usage; no implementation or
  adversarial-review verdict is claimed by this marker. Antigravity `1.1.22` current model inventory
  includes `gemini-3.1-pro-high`. Subsequent tool-free availability and bounded packaging-review
  inference evidence is recorded below; availability alone is not an adversarial PASS.
- **Permission gate:** the same-version T166 disposable auto-mode proof remains prerequisite evidence,
  not a blanket runtime grant. The built-in Claude capability adapter currently declares organization
  policy unknown and only manual/bounded-allowlist support. Auto must remain held without fresh trusted
  evidence for the exact runtime; authentication, version, personas, or the historical proof alone
  cannot populate that authority. Bypass remains excluded from missions.
- **Cross-cutting privacy RED/GREEN:** profile/draft malformed Unicode and terminal/credential text
  failed two new tests before shared validation; focused profile/wizard suites passed29/29 afterwards.
  Logger C1/Unicode/credential and envelope-overwrite tests failed2/2 then passed2/2. Memory preview
  fuzz failed first on unsafe Unicode, then multibyte byte overflow; focused memory/coordination
  suites passed26/26 after correction. Escaped duplicate manifest keys failed before decoding keys
  for comparison, then profile contracts passed19/19. Unsafe template names and citation identifiers
  failed2/2 then passed2/2 in a focused run. Final aggregate suites remain pending US8 integration.
- **Scale checks:** disk-backed 10,000-revision memory FTS and 100-profile/100-template/20-draft
  list/detail measurements both passed their500ms/1000ms p95 thresholds. These are local repository
  measurements, not installed UI/mission/recovery performance acceptance. T151 remains open.
- **Private persona boundary:** added installed acceptance that scans the actual uncompressed ASAR
  archive and unpacked text assets, supplementing the existing Vite/Forge private-persona guards.
  This cycle has not yet produced or accepted a new installed artifact.
- **UI RED:** the first keyboard mission-creation Electron test failed for the missing New mission
  button before the new mission components were implemented. Full mission lifecycle/recovery journeys
  are written and await the backend/build checkpoint. T131/T144-T146 remain open until verified.

### US8 implementation checkpoint, 2026-08-30 19:18 EDT

- Built desktop checkpoint passes. Real Electron mission creation, pause/resume, cancellation,
  content deletion and crash recovery pass three scenarios. All four accessibility scenarios pass,
  including keyboard focus, contrast/reduced motion, idle stability and 200% mission-form reflow.
  Additional allowlist and concurrent-revision scenarios are being validated; this is not T149 signoff.
- Five real fixture sessions (one supervisor plus four workers) passed the mission detail p95 <=1s
  and crash-to-recovered-mission <=5s gates; zero sessions restarted. One test passed, nine skipped
  in that focused run. Earlier 1,000 duplicate presentation calls all failed with exactly one durable
  applied delivery. Full final integration remains pending the native supervisor registry extension.
- Provider-bridge text/authority fuzz exposed missing PEM/colon-secret rules in mailbox content;
  shared validation closes that gap. Provider plus desktop coordination contracts pass32/32.
  Independent earlier privacy re-review passes; profile/template/memory contracts pass41/41 and
  logging2/2 at that checkpoint. No rejected content is echoed in error assertions.
- The additive migration inventory now covers all nine supervisor tables, with4/4 migration tests.
- Packaging now rejects native PE architecture mismatch and malformed binaries, including dependent
  DLLs; node-pty packaging selects only the requested Windows prebuild. Partial signing configuration
  fails instead of silently falling back to unsigned output. Guard2/2, migration4/4, logging2/2 pass.
  No new packaged artifact, signature, ARM64 machine run or uninstall acceptance is claimed yet.
- Independent UI review found omitted effective allowlists, dropped typed separators, stale revision
  version adoption and missing focus transitions. All four are fixed; the reviewer then identified
  stale local allowlist text after removing an earlier worker, now synchronized without losing commas.
  A packaging review identified skipped DLLs, now included. Final focused re-review remains pending.

## Rollback and recovery notes

- Coordination schema changes are forward migrations; retain a pre-migration database backup for
  manual recovery until the migration and restart suite passes.
- Startup never replays unknown terminal, export, or supervisor effects.
- Disable unproved provider automation per provider/version and retain the manual path.
- A failed story gate stops advancement to dependent phases; completed earlier milestones remain
  independently usable and are not relabeled as passing later gates.

### Review and artifact checkpoint, 2026-08-30 19:53 EDT

- Aggregate checkpoint: 251 unit tests and 226 contract tests passed, exit0, before subsequent
  native/review fixes. Typecheck passed after exact unknown-attempt/lease acknowledgement inputs.
- Interim portable x64 package built, then actual-artifact acceptance passed7/7, exit0. Tested
  Windows11 Home build26200 x64, app0.0.0. ASAR/unpacked private-persona scan, architecture/fuses,
  native bootstrap, both provider probes and second-instance exclusion passed. The artifact was
  unsigned; there was no portable-exe checksum. This is not Squirrel installation/uninstall,
  ARM64, signed production, or live mission-provider proof. Evidence: `tmp/us8/interim-x64-acceptance.json`.
- Later focused Electron run:10passed/2failed. All four accessibility tests, ordinary launch with
  explicit process-limit8/default-reset1, and five mission lifecycle/revision/allowlist/focus tests
  passed. The two new unknown-outcome flows failed at existing-worker assignment with
  `MISSION_ENVELOPE_STALE`; no successful acknowledgement/no-replay claim is made until corrected.
- Independent OpenAI UI re-review:PASS for exact captured attempt/lease pairs, stale-inspection
  clearing, contained-process editing, and deletion disclosure. Backend deletion/enforcement excluded.
- Claude Opus5/xhigh tool-free domain/storage snapshot review completed exit0, USD1.054574.
  It raised nine findings, not PASS. Main-caller/schema false-positive disposition and fixes for
  valid lease/deletion/terminal-state issues are being recorded by the implementer. Snapshot/result:
  `tmp/us8/domain-review-input.md`, `tmp/us8/claude-domain-review.json`.
- Antigravity1.1.22 Gemini3.1ProHigh/high packaging snapshot review completed in plan/sandbox mode,
  exit0, one turn,41208 reported tokens (23904 input,17304 output including16312 thinking).
  Conversation `2e8e7baa-4cd3-491c-9287-4a3fce19b0e0`; result
  `tmp/us8/gemini-packaging-review-initial.json`. Five findings, not PASS. Full post-copy asset
  scanning, explicit unsigned-local override, recursive unpacked-native signature checks and robust
  startup-log waiting now address them; re-review pending. Five added asset-extension regressions
  failed first, then all7 persona-guard tests passed. Actual unsigned artifact signature acceptance
  now fails by default (expected RED); with explicit local override the focused signature test
  passes1/1 and records production signature gate NOT passed. Final package rebuild remains pending.
- Independent native/host review found a P1 named-job last-handle retention hole and P2 output
  truncation/registry-watch recovery gaps. Preserve unnamed outer kill-on-close containment with
  separately named inspection scope; regression and final native rebuild underway. Earlier native
  build success is not evidence that these later findings are resolved.
- No commit, push, merge, deployment, public release, hosted CI or human final acceptance occurred.

Root task accounting: T131 authored failing mission journeys and T144-T146 renderer implementation
are complete, with scoped independent UI PASS and five core mission flows passing. The two later
unknown-effect end-to-end variants remain blocked at a backend assignment defect, explicitly retained
under T149 final integration rather than reported green. T152 accessibility coverage passes4/4 on
built Electron: keyboard/focus/names, terminal escape/stop, contrast/reduced-motion/idle and 200% form
reflow. This is local coverage, not an external accessibility certification.

### Packaging re-review, 2026-08-30 19:58 EDT

Gemini3.1ProHigh/high final bounded packaging re-review:PASS, exit0, one turn,51127 reported tokens
(25126input,26001output including25713thinking),166.52s, conversation
`729381f8-3ecb-41e6-bf3d-9ff67a474d98`. Snapshot/result: `tmp/us8/gemini-packaging-review-input.md`
and `tmp/us8/gemini-packaging-review.json`. The second review is retained separately. Its suggestion
to allow NotTrusted signatures was rejected: missing trust evidence must not certify production.
Other follow-ups are fixed: chunked UTF8/UTF16 dual-alignment asset scan, literal signature paths,
unresolved-link rejection, cookie-encryption fuse assertion and parsed startup events. Thirteen
persona/native-architecture unit regressions pass, including copied dependency assets, chunk
boundaries and directory junctions. This PASS covers source safeguards only, not final native
containment, whole-US8 authority, signed binaries, ARM64 or installed/uninstall acceptance.

### Windows and authority checkpoint, 2026-08-30 20:22 EDT

- Rebuilt the native addon/bridge and Electron application at 20:05, exit0. Native review now
  passes for unnamed outer kill-on-close containment with named query-only tracking scope;
  retained inspection handles cannot keep the containment job alive. The backend reports
  20 native library and 12 bridge tests passing, plus rustfmt/clippy; final sequential rerun remains pending.
- Seven mission Electron E2Es pass, including both previously failing cancelled-unknown flows.
  Exact structural launch-snapshot comparison and attaching the reserved session before host-budget
  acknowledgement fixed the assignment failures; unknown inspection still binds the exact attempt/lease.
- Seventeen distinct real-Windows mission cases passed across focused runs: three workers and result
  links, offline Codex launch, no-bypass hold, exact worker authority/ancestor rejection, write conflict,
  loop stop, typed outcome handling, native elapsed/no-progress/output bounds, safe before-effect
  reassignment, crash/unknown inspection and power invalidation. The new Claude-auto fixture case
  and folder-drift recovery case await the latest build; they are not yet claimed passing.
- Four active workers plus supervisor passed detail p95 <=1 second and recovery <=5 seconds,
  with four unknown attempts/leases after crash and zero automatic restarts. This focused run does
  not establish strict idle CPU/memory release budgets.
- Folder drift exposed a cleanup defect: descriptive error text was incorrectly used as a typed
  reason code. The fix uses the typed code and enters teardown even if lifecycle event emission
  fails. Independent review then found bridge-revocation event delivery could still interrupt
  teardown; a final cleanup fix and explicit throwing-event regression are in progress.
- Claude Opus5/xhigh broader authority snapshot review returned bounded PASS, exit0,
  USD2.177605, 685.114 seconds; session `8de7bbd7-10cb-43da-83ee-e7066239a106`.
  Evidence: `tmp/us8/claude-authority-review-input.md`, `tmp/us8/claude-authority-review.json`.
  Its own-work-state residual is covered by a subsequent activation/launch guard. Its host-output
  waiter identity residual is being tightened and tested before final verification. No tool access
  was supplied to this reviewer; this is source review, not live mission proof.
- The initial Antigravity whole-authority attempt returned an empty response after a headless
  filesystem-read permission denial. CLI status SUCCESS/exit0 is not a review PASS. Permissions were
  not changed or bypassed. Two smaller authorized source excerpts are now being reviewed inline
  with no tools, maintaining the existing plan/sandbox restrictions.

### Final review dispositions, 2026-08-30 20:34 EDT

- Cleanup and host-budget ACK regression tests each failed before the fixes and passed after them.
  Full supervisor/provider contracts then passed30/30, typecheck/lint passed. Independent cleanup
  re-review PASS: event callbacks cannot strand later cleanup, and exact session/attempt/mission/
  binding ownership is validated before an output ACK resolves. Durable unknown leases remain held.
- Antigravity recovery review found a real Resume race during awaited provider revalidation.
  Resume now rechecks envelope version, state, current supervisor identity, unknown leases, exact
  synchronous live binding and bounds inside the write transaction. A delayed-probe regression
  changed from incorrectly running with an unknown lease to rejection (RED to GREEN).
- Antigravity authority initial six findings were rejected after tracing strict schemas/main callers
  and requirements: mission break-glass must stay excluded, main alone chooses plannedSessionId,
  worker results have worker-specific ownership, nested specification objects are invalid, expiry
  cannot free uncertain leases, and unknown attempts never auto-retry. Re-review bounded PASS,
  `gemini-3.1-pro-high`/high,104.124s,35749 reported tokens,
  conversation `47946f81-6826-478a-81db-0c1fcf2615f3`.
- Antigravity recovery re-review bounded PASS,54.822s,28480 reported tokens,
  conversation `c15d1eb7-364b-4e8f-86d8-78ae6ae07e6a`. Only the Resume race required a new fix:
  completed missions already reject unresolved leases and native missing scope already returns an
  empty snapshot. The reviewer called those two dispositions fixed, but they were existing caller/
  native guarantees, not code changes. Both final reviews received inline source only, no tools,
  under unchanged plan/sandbox restrictions. No permission bypass followed the initial denial.
  Snapshots/results are `tmp/us8/gemini-authority-final-input.md`, `gemini-authority-final.json`,
  `gemini-recovery-final-input.md`, and `gemini-recovery-final.json` in the same directory.
- Rebuilt app then passed18/19 Windows mission cases, including folder drift, explicit resume and
  reassignment. The Claude-auto fixture correctly held the test's Opus selection for a missing
  high-cost escalation reason. Changing this inert fixture to the allowed Sonnet5 runtime made the
  remaining focused case pass1/1. This is deterministic fixture capability evidence, not real Claude
  organization-policy authorization or installed-provider automatic execution.
- Independent final spec/plan/contracts/constitution review found no material missing adopted
  mechanic or new P1/P2 implementation defect; bounded alignment PASS. Final suite/package results
  and explicit human/platform/provider gates remain required. The historical US5 tables above are
  now labeled as historical, and tasks.md records the bounded host-meter implementation deviation
  while preserving its original host-file restriction for traceability.

### Implementation task accounting, 2026-08-30 20:37 EDT

T127-T143 and T147 are now checked for authored regressions and reviewed implementation. T131 and
T144-T146 were already checked for the mission UI. T150 and T153 are checked for the fuzz/privacy
hardening and reviewed content boundaries; T155 is checked for the runnable quickstart and recovery/
release distinctions. The final aggregate is 269 unit tests and 247 contracts passing after the
20:34 all-source freeze. T148 remains partial: its expanded deterministic acceptance has18passes
and one optional packaged-lookup skip, but that does not establish installed live mission execution.
T149 retains owner/live-provider acceptance obligations. T154/T157/T158 retain signed, installed,
ARM64, uninstall, exact live-provider and final integration/approval obligations.

The first final-sequence format check failed on the SDD progress ledger and two root privacy test
files. Formatting those three files resolved it; the entire sequential run restarted from format,
with the failed attempt preserved in `tmp/us8/final-verification-format-failure.json` and
`tmp/us8/final-format-first-failure.log`. No behavior changed for that remediation.

Gitleaks scanned the tracked working diff plus nonignored untracked file contents with full
redaction:780972bytes, exit0, no leaks found. Report:`tmp/us8/gitleaks-current-work.json`.
This is a current-work scan, not a repository-history or external-account secret audit.

### Final sequential local verification, 2026-08-30 20:46 EDT

All commands ran sequentially after the all-source freeze, from20:34:42 through20:45:46 EDT.
Every final exit was0. Exact timing/log paths: `tmp/us8/final-verification.json`.

| Command | Exit | Final result |
|---|---|---|
| `pnpm format` | 0 | PASS after formatting-only remediation |
| `pnpm lint` | 0 | PASS |
| `pnpm rust:fmt` | 0 | PASS |
| `pnpm rust:check` | 0 | PASS, warnings denied |
| `pnpm rust:test` | 0 | 20 native library +12 bridge tests passed |
| `pnpm typecheck` | 0 | PASS |
| `pnpm test:unit` | 0 | 30 files,269 tests passed |
| `pnpm test:contract` | 0 | 13 files,247 tests passed |
| `pnpm desktop:build` | 0 | Main,preload,renderer built; persona module guard passed |
| `pnpm proof:windows-supervision` | 0 | 3 tests passed |
| `pnpm test:integration:windows` | 0 | 17 files,96 passed,1 intentional skip |
| `pnpm test:e2e` | 0 | 41 passed |

The single integration skip is the existing locked/read-only database harness case at
`tests/integration/windows/recovery.test.ts`: the harness cannot retain the necessary file lock
across Electron startup. It is not a skipped US8 mission case. All19 new mission Windows cases
and all7 mission E2Es passed in the final complete run. T151 measurement coverage and T156 are
checked. Default development idle CPU/working-set measurements are observational rather than
strict installed release gates; latency/recovery/FTS bounds are enforced. Final package and
credentialed provider results follow separately and do not imply hosted CI or owner acceptance.


### Packager crash diagnosis and regression, 2026-08-30 20:54 EDT

The initial final `pnpm package:win` and direct Forge retry both failed during the first persona
scan with Windows exit3221226356 (`0xC0000374`), after native/app builds succeeded. A tagged stage
probe localized the failure before runtime dependency copying. A standalone scan narrowed it to
Node24.18.0 UTF-16 decoding of a Buffer view with an odd byte offset. Minimal reproduction:
`Buffer.alloc(524026, 0x61).subarray(1).toString('utf16le')`. On this host, the odd-offset view
crashed; copying it to an aligned Buffer passed. Node22.23.1 also passed the original full scan,
without changing the configured runtime.

A fresh Node subprocess regression at the real file-scanner seam failed first with3221226356.
The scanner now copies the odd-alignment view before decoding. Both UTF-16 alignments, UTF-8,
all asset types and the bounded chunk overlap remain checked; no guard was disabled. All14
persona/native guard tests pass and the original actual-build scan now passes on Node24.18.0.
Independent bounded re-review PASS; the additional allocation stays within the existing read
window. Production config debug markers were removed; throwaway reproduction scripts/logs remain
clearly named in ignored `tmp/us8` as diagnostic evidence.

After this packaging-only change, `pnpm format`, `pnpm lint`, `pnpm typecheck`, and the full unit
suite passed again (270tests). Runtime/domain/native/renderer source did not change after the
completed full Windows/contract/E2E sequence above. Final package/acceptance results follow below.
Failure evidence is preserved in `final-package-win.log`, `final-package-direct.log`,
`package-stage-probe.log`, `scan-repro-node24.log`, `scan-repro-node22.log`, and `scan-minimal.log`
under `tmp/us8`; the normal command retry writes `final-package-win-fixed.log`.

### Final x64 package and acceptance, 2026-08-30 20:57 EDT

`pnpm package:win` succeeded after the aligned-decoder fix (exit0). It rebuilt native/app output,
created the portable package and Squirrel x64 Setup/nupkg, and wrote SHA-256 sidecars. Both
sidecars independently match their files (`tmp/us8/final-distributables.json`):

- Setup: `apps/desktop/release/make/squirrel.windows/x64/ThreadHelm-Setup-x64.exe`,156184576bytes,
  SHA256 `2ea1cb81064633b54db0d685995ccc982e5cb62586d0637ee391a6e90d07651e`.
- Package: `apps/desktop/release/make/squirrel.windows/x64/ThreadHelm-0.0.0-full.nupkg`,155439756bytes,
  SHA256 `996b821f67edc7043e230a12955fe3d8065293304b6850be8fc93853a4ffb603`.

Final actual-artifact acceptance passed7/7 with the explicit local unsigned override. Expanded
coordination acceptance passed19/19, including packaged bridge lookup: combined26passed, exit0.
Tested Windows11 Home build26200 x64, ThreadHelm0.0.0. Actual ASAR/unpacked content contains no
private Marvel persona material; target native PE files, required unpacked dependencies, all
production fuses, native bootstrap, provider probes, and single-instance behavior passed.
The portable exe has no sibling checksum, so that internal scenario is explicitly unverified;
the distributable Setup/nupkg checksums above were verified separately.

Strict signature acceptance on the same final artifact failed as expected with `NotSigned`,
exit1. Local override acceptance records9unsigned app/native files and
`signatureReleaseReady:false`. Valid Microsoft-signed terminal dependencies are not evidence
that ThreadHelm is signed. Nothing was installed or uninstalled; no ARM64, live mission, trusted
release signature, hosted CI, integration-on-main, or owner acceptance is established here.
Reports/logs: `tmp/us8/final-x64-acceptance.json`, `final-artifact-acceptance.log`,
`final-artifact-strict-signature.json`, and `final-package-win-fixed.log`.

### Packaged performance gate and runtime diagnosis, 2026-08-30 21:13 EDT

The 20:56 packaged x64 executable was measured with fresh disposable user data, no sessions,
no inspector, a visible normal-size window, ten seconds of settling and twelve five-second
process-family samples. Median CPU was 0 percent of one core (PASS against 1 percent); peak
summed working set was 435.293 MiB, settling near 402.4 MiB (FAIL against 250 MiB).
The measurement script's exit0 means measurement and cleanup succeeded, not that the budget
passed. Report: `tmp/us8/final-packaged-idle-performance.json`. This is a real release blocker;
T151's authored measurements and passing latency tests do not close the memory gate.

Exploratory attribution at fifteen seconds showed four processes: main119.27, GPU126.39,
utility48.56 and renderer118.63 MiB, total412.85 MiB. The same package with `--disable-gpu`
used373.16 MiB, still above the unchanged budget. A separate blank Electron44 window with
sandbox/context isolation and normal dimensions used280.59 MiB with default graphics and
275.12 MiB with software rendering. Renderer-ready markers and all four process rows verified
that the final baseline actually loaded. Earlier baseline attempts had malformed PowerShell
arguments and never loaded a renderer; their approximately57 MiB readings are INVALID and
must not be used. Valid results: `tmp/us8/packaged-memory-ab.json` and
`tmp/us8/minimal-electron-memory-ab.json`. These short diagnostic snapshots are not repeated
release benchmarks or proof that every Electron configuration exceeds the target.

Source inspection identified avoidable eager contract/schema initialization in preload and
eager terminal/view modules, but no idle terminal-buffer allocation, refresh polling, extra
window or large configured SQLite cache. These are candidates for a separately measured
performance iteration, not demonstrated closure of the150-185 MiB overage. No graphics default,
working-set metric, process isolation, sandbox, security setting or250 MiB requirement was
changed. No working-set trimming was performed. Details: `tmp/us8/memory-analysis.md`.

### Credentialed development smoke and final fatal-error fix, 2026-08-30 21:13 EDT

The separate live development smoke passed3/3 with Codex0.151.0 and Claude Code2.1.251,
both authenticated. It exercised real CLI process launch and cleanup through the development
app, without submitting model work or recording provider messages. It does not establish
installed mission, real Claude-auto classifier, read/edit/test, billing or owner acceptance.
Evidence: `tmp/us8/final-live-provider-smoke.log`. Unavailable provider cases now use actual
test skips rather than silently passing, and output records sanitized version/readiness only.

Final privacy review found that the preexisting uncaught-exception handler printed raw error
stack/message/string values. A small `main/fatal.ts` handler now ignores the thrown value,
writes only the fixed `THREADHELM_FATAL UNCAUGHT_EXCEPTION` marker and exits1 even if writing
fails. Five real Node subprocess regressions reproduced private stack/string leakage before
the fix and passed afterward; independent bounded source review PASS. This covers the handler,
not V8's preparation of thrown values or static-import failures before handler registration.
Runtime source froze at21:08 EDT; the20:56 artifact above predates this final fix and remains a
historical checkpoint until the fresh build/acceptance below.

The first post-fix verification restart stopped at lint because a temporary CommonJS baseline
probe used `require`. Its source was archived as non-executable diagnostic text after the valid
baseline finished, and the entire verification sequence restarted. No production lint rule was
disabled. Failure record: `tmp/us8/closure-verification-probe-lint-failure.json`.

### Final runtime-source verification, 2026-08-30 21:24 EDT

The complete sequence was rerun after the21:08 fatal-handler source freeze and probe cleanup.
All twelve commands exited0: format, lint, Rust format/clippy/tests, TypeScript checking, unit,
contract, desktop build, native supervision proof, full Windows integration and full E2E.
Exact timestamps and logs are in `tmp/us8/closure-verification.json`; the final E2E ended at
21:23:57 EDT. Results:275unit across31files,247contracts across13files,20native-library plus
12bridge Rust tests,3supervision proofs,96Windows integration passes with the same single
preexisting database-lock harness skip, and41E2E passes. All19mission integration cases and
all7mission E2Es passed. No runtime source changed after this sequence began.

The five fatal-handler subprocess cases also passed under Node22.23.1, matching CI's Node22
major, and all11persona scanner cases passed under that runtime. These are compatibility
checks, not hosted CI. Logs:`tmp/us8/closure-node22-compatibility.log` and
`tmp/us8/closure-node22-persona-guards.log`. Current-work Gitleaks scanned813740bytes with
redaction and found no leaks (`tmp/us8/gitleaks-closure-work.json`); this is not a history audit.

### Current final checkpoint — 2026-08-30 21:30 EDT

This table supersedes earlier progress/status tables for current completion claims. Feature002
remains selected and active.161of166tasks are checked; T148,T149,T154,T157,T158 remain open.
The packaged memory failure is additionally an explicit release blocker despite T151 measurement
coverage being complete. No commit, staging, push, merge, install, uninstall or release was performed.

| Evidence category | Current result and limitation |
|---|---|
| US8 implementation | Mission authority, bounded DAG/leases/startup, durable recovery, immutable profile/runtime bindings, typed returns, UI and content deletion implemented; bounded independent source reviews passed |
| Local full verification | All twelve commands exit0;275unit,247contract,32Rust,3nativeproof,96Windows with1preexisting skip,41E2E; full results above |
| Focused performance |4passes; mission detail p95 23.7ms; recovery2041.4ms;1000duplicate rejection p95 3.2ms;100profiles/100templates/20drafts p95 76.7ms;10,000revision FTS p95 2.5ms. Six unrelated cases were filtered out only for this focused rerun, not omitted from the full suite |
| Final x64 package | Normal `pnpm package:win` exit0 at21:26:41; portable/Setup/nupkg rebuilt after final runtime fix |
| Actual private-persona boundary | PASS: final ASAR and unpacked assets contain no private Marvel persona material; generic starters remain bundled and personal local imports remain supported |
| Local artifact acceptance |26passes under explicit unsigned-local override; x64 PE/native dependencies, fuses, bootstrap/probes and single instance passed; packaged bridge lookup passed |
| Signing | BLOCKED: strict default gate exits1 with `NotSigned`; local report records9unsigned app/native files and `signatureReleaseReady:false` |
| Packaged idle CPU | PASS: median0percent of one core over twelve five-second windows, no sessions/no inspector |
| Packaged idle memory | FAIL: final peak413.367MiB against250MiB; no budget/metric/security relaxation; source optimization/runtime investigation remains necessary |
| Live providers | Development launch/cleanup smoke3passes with authenticated Codex0.151.0/Claude2.1.251; prior isolated T166 auto proof remains scoped historical evidence; installed US8 mission/auto/classifier/usage proof remains unverified |
| Model reviews | Bounded OpenAI/Claude/Antigravity source reviews passed after documented fixes/dispositions; not owner acceptance |
| Other release gates | Signed x64/ARM64 installed execution, actual installer/uninstaller cleanup, exact installed live mission proof, hosted CI/main integration and explicit human acceptance remain open |

Fresh evidence: `tmp/us8/closure-artifact-checks.json`, `closure-x64-acceptance.json`,
`closure-strict-signature-report.json`, `closure-performance-details.log`,
`closure-packaged-idle-performance.json`, `closure-distributables.json`, and
`closure-package-identity.json`. These ignored local reports are supporting artifacts; the
facts and limitations above are recorded here for durable review. No model message bodies or
credentials are included in this record.

Final distributable identities, with both SHA-256 sidecars independently matched:

- `ThreadHelm-Setup-x64.exe`:156184576bytes,
  SHA256 `553220be651924e529f410571961e4ee0b56f6d1594962a0b8a788c46c70e044`.
- `ThreadHelm-0.0.0-full.nupkg`:155439853bytes,
  SHA256 `1ae5df1bc00ddf3453d8b391585f81add4f732cc9945b6ef006b7ea38384348c`.
- Final `resources/app.asar`:
  SHA256 `6e00541c6de7a3ec3749294574fea8396e4f5135fb8cd9e6f2f85c01352e1e53`.

The portable executable itself has no adjacent checksum; its internal checksum acceptance
scenario remains explicitly skipped. The verified distributable checksums above do not imply
code signing. The final measurement used the final package identity and cleaned its disposable
user data afterward; the measurement command exited0 while its memory-budget boolean was false.

Next required closure work is a measured reduction of packaged idle memory without weakening
isolation; an approved exact installed-provider mission acceptance run with real auto-policy and
usage evidence; trusted signing plus x64/ARM64 installer/uninstaller validation; then hosted
integration and owner acceptance. These are not satisfied by the deterministic fixtures, prior
isolated provider proof, passing build or current unsigned package.

### Draft PR sequence and preload follow-up — 2026-08-30 21:52 EDT

The owner authorized starting the recommended draft-PR/closure sequence. The reviewed combined
US7/US8 implementation was committed as `da3dc66ab82497b33f72c4c6e0cf442bbf06d375` and pushed to
`codex/us7-template-persistence`; draft [PR17](https://github.com/Lastonedown86/ThreadHelm/pull/17)
is open. All pending source/tests/feature documents were in that scope; ignored probes, logs,
packages and credentials were excluded. Two Markdown hard-break spaces in the previously
untracked roadmap were replaced with paragraph separation to satisfy staged whitespace checks.
The exact staged content passed the redacted secret scan. The earlier no-commit statements above
describe their historical checkpoints, not the current branch state.

Hosted CI passed on `da3dc66`: Windows x64 and Windows ARM64, plus CodeQL Actions,
JavaScript/TypeScript and Rust analysis. CI run33348003266 and CodeQL run33348001972 are linked
from PR17. No reviewer approval or merge occurred. This is hosted native/dev-runtime evidence,
not signed ARM64 packaging, actual installation/uninstallation or a credentialed mission proof.

The next bounded performance change separates IPC names into a dependency-free contracts
protocol subpath. Preload imports only those values and erases full-contract type imports.
Frozen operation/event lists define exact schema-table keys through exhaustive TypeScript
`Record` checks; main retains sender/request/response/event validation. The preload still exposes
fixed named methods, never a generic invocation channel. No permission, sandbox, isolation,
graphics, budget or provider configuration changed.

A regression bundled and executed the real preload entry: before the fix it found19 schema/Zod
modules while its method/event behavior tests passed; after the fix all3cases passed with no
schema runtime modules. Tests compare all exposed methods and listeners with main's schemas,
attempt channel substitution, reject unknown event subscriptions, verify unsubscribe, and retain
stream-port transfer. Independent source review passed. The production preload fell from213.28KB
to4.79KB (83modules to3); renderer output fell from1,380.01KB to1,370.96KB. These are bundle
measurements, not resident-memory estimates.

Post-change local checks passed: format, lint, typecheck,275unit tests,250contracts, desktop
build, all41E2Es, and29focused Windows mission/authoring/recovery cases with the same preexisting
database-lock harness skip. The other Windows files and Rust source were unchanged; their full
previous local and hosted results remain separate. Records:`tmp/us8/preload-final-verification.json`,
`preload-protocol-red.log`, `preload-protocol-green.log`, and `preload-build.log`.

The normal package command passed again; all26artifact/coordination cases passed with the
explicit unsigned-local override. Actual ASAR/unpacked private Marvel content remains absent.
Strict default signing still exits1 with `NotSigned`;9unsigned app/native files remain. Both
distributable checksums match. Final package identities for this follow-up:

- Setup156143616bytes, SHA256
  `e40fba0c8a43772472b304c097221051afb0e3784e0a8222bd9abab07f295e29`.
- nupkg155399778bytes, SHA256
  `c21464f36a7453d111ad3d53382662dd4faac7b78fadbf382aaf45e8fecc2adc`.
- ASAR SHA256 `3f74ffa6ac8176c4f83a2a68f320da1e05e50c20cf0254f8a1c155a667b031a1`.

The fresh visible packaged app, no sessions/no inspector, measured399.844MiB peak working set
over twelve five-second windows, with median CPU0percent. CPU passes; memory still FAILS250MiB.
This is lower than the preceding413.367MiB observation, but the single before/after measurement
does not establish the entire difference as causal savings from preload. The verified removal
of schema initialization is retained; the release memory blocker remains open. Reports:
`tmp/us8/preload-artifact-checks.json`, `preload-x64-acceptance.json`,
`preload-distributables.json`, and `preload-packaged-idle-performance.json`.

Read-only installed-proof assessment clarified the remaining work:

- The production Claude adapter reports organization policy unknown and manual/bounded-allowlist
  support. Authentication/version probing supplies no trusted auto-policy verdict. Real auto is
  held correctly; a trusted production capability-evidence integration is still needed. Historical
  T166 proof, fixture injection and absence of a known prohibition must not grant current authority.
- A copied whole x64 package plus fresh user data and disposable workspaces permits isolated
  packaged acceptance. The report writes beside the exe; do not aim it at an existing installation.
  Live manual-provider mission acceptance remains separate from deterministic fixture coverage.
- Fresh user data does not isolate Squirrel's product registration, files or shortcuts. Genuine
  Setup/uninstall proof requires a disposable Windows account or VM. Provider-owned credential
  caches are also distinct from ThreadHelm user data; do not copy/read credentials to fake isolation.
- Signing, signed ARM64 package acceptance, actual installed-provider proof and explicit human
  acceptance remain unverified. No installer or real mission was run by this follow-up assessment.

Task count remains161/166; T148/T149/T154/T157/T158 and the memory blocker remain open. Keep PR17
draft and Feature002 active. Verified Mission Delegation has not started. The preload follow-up
requires its own final-head hosted check result; `da3dc66` CI must not be attributed to a later SHA.

## Closure follow-up: unsigned distribution and remaining evidence

On 2026-08-30 the owner explicitly confirmed: "This will be a unsigned app". This supersedes
the earlier trusted-signing blocker and local-only unsigned exception above; those earlier
observations are retained as historical evidence, not current release policy. The normal artifact
acceptance path now accepts `NotSigned` or `Valid`, records unsigned files and publisher-trust
status, and rejects invalid or unrecognized signatures. No certificate, self-signed certificate,
or local unsigned override is needed. Checksums, private Marvel exclusion, production fuses,
native architecture, installed cleanup, and all other gates remain in force.

The installed Claude Code 2.1.251 no-prompt initialization interface does not provide the fresh
positive organization-policy attestation required by the launch contract. Controlled probes
reported `current_permission_mode: auto` even with feature-flag fetching disabled. The CLI implementation
defaults missing/unrecognized remote eligibility to enabled, while its initialization response
does not expose that provenance or freshness. Unsupported-model and explicit-disable controls
returned default mode. These observations demonstrate why mode, model support, authentication,
or absence of denial must not authorize auto. No user/model frames were submitted, no global or
project settings changed, and no credential values were recorded. Production remains held on
unknown organization policy; a future supported attestation interface is required to close that
portion of T148/T149.

The follow-up removes the initial renderer's xterm, wizard, and full validation-schema imports.
Terminal limits and stream schemas now have narrow contract exports; main validation is unchanged.
Real in-memory bundle tests proved the eager dependency regression before the change and the
deferred graph afterward. Early transferred ports remain unstarted until the terminal loads, with
bounded host buffering and ACK-after-write preserved. Replaced, failed, unsolicited, and abandoned
ports close. The initial main entry now handles Squirrel events independently of native/coordinator
imports, so a damaged native addon cannot prevent shortcut removal or obsolete-version exit.
Actual bundled-entry tests reproduced and then closed that failure, including fixed fatal reporting.

Initial verification on the deferred renderer passed all 41 E2Es and 29 focused Windows cases,
with the same preexisting database-lock harness skip. After the isolated lifecycle entry and
diagnostic runner changes, formatting, lint, typecheck, 342 unit cases, 264 contracts, and all three
real architecture proofs passed. Later review tightened descendant identity against host/root PID
reuse; its focused regression and final artifact/hosted results are recorded below when completed.

The new disposable hosted workflow builds the actual Squirrel Setup on x64 and ARM64, checks its
SHA-256, installs only on a fresh GitHub-hosted account, and runs actual installed-artifact acceptance.
It additionally exercises the installed N-API/bridge and the installed Electron main/session-host/
ConPTY path using an explicit standalone Node diagnostic helper. This grants no normal provider
eligibility, uses no provider account/model work, and changes no production fuses. Uninstall uses
only that installation's bounded Update.exe path in `finally`; remaining payload, registration,
shortcuts, processes, or session credentials fail rather than being manually removed. Reports
distinguish real installed containment from live provider missions, which this workflow does not run.
No installer was executed on the developer's account. Windows Server x64 evidence, if produced by
the hosted image, is not promoted to Windows 11 client acceptance.

Final local follow-up source verification passed formatting, lint, typecheck, 349 unit tests,
264 contracts, and all three real architecture proofs. The stale-host/root-PID regressions both
reproduced the false-positive path and passed after rejection was added. Independent review of
the diagnostic and installer boundaries found no other actionable issue. Staged Gitleaks reported
no leaks.

Normal x64 packaging succeeded without signing inputs or any unsigned override. All 26 artifact/
deterministic coordination acceptance cases passed under the default unsigned policy. The actual
ASAR and unpacked resources exclude private Marvel material. The fresh packaged Electron
main/session-host/ConPTY proof passed with the real packaged bridge: dormant scope empty, exact
host/root/bridge membership, empty scope after termination, and host/root/bridge death on handle
close. It used an explicit standalone diagnostic helper, not a live provider mission, and did not
install Squirrel on the developer's account. Evidence: `tmp/us8/closure3-packaged-proof.json`,
`closure2-x64-acceptance.json`, and `closure2-artifact-checks.json`.

Fresh package identities (matching published SHA-256 sidecars):

- Setup: 156149248 bytes, `db18af7d3f55649f93fd38334adeb5de73e27e748351913f57c386b36139a175`.
- nupkg: 155404263 bytes, `626d7234bd93c93afe22b888f22fd3cbe1156e67d7fe431593c70fa8737fd286`.
- ASAR: `64c825445616d3342b4651bf124cda073cfec1454990528e67ea980aa41124a8`.

Fresh packaged idle measurement at 22:39 EDT: **380.324 MiB peak**, median CPU **0%**, twelve
approximately five-second windows, four application processes, visible app, no sessions/inspector,
fresh user data. CPU passes; memory still fails the unchanged 250 MiB gate. The previous observation
was 399.844 MiB; this single before/after run does not attribute the entire difference to deferred
loading. No graphics, sandbox, metric, budget, or working-set trimming changed. The required shell
reassessment is recorded in `docs/architecture/desktop-shell-reassessment.md`; it recommends a bounded
nonshipping comparison and does not approve a migration or claim an unmeasured alternative passes.
Task count remains 161/166 pending hosted installed proof, exact provider evidence, and owner closure.

The final full E2E rerun on `13aa68c` exposed one test-harness reentrancy failure (40 passed,
one failed). A direct Playwright main-process evaluation entered `replyFromProvider` during a
better-sqlite3 row-factory callback. The shared harness already queues work with `setImmediate`;
the coordination spec had bypassed it for replies and three lifecycle injections. These callers
now use typed methods on the existing queued path, with assertions and production code unchanged.
The original trace/error context were preserved under `tmp/us8/closure4-authority-reentrancy*`.
All three affected journeys passed three consecutive runs (9/9); a fresh full suite follows.
That fresh full E2E suite completed at 22:51 EDT with all 41 cases passing.

The first real hosted installer run, `33351451272`, exercised x64 on Windows Server 2025 and
ARM64 on Windows 11 Enterprise 26200. Both Setup operations, registrations, shortcuts, installed
native proofs, and installed Electron main/session-host/ConPTY/bridge proofs passed. Both nested
artifact suites and uninstall-cleanup checks failed, so the workflow is not a pass. Reports are
preserved under `tmp/us8/closure4-hosted-x64` and `closure4-hosted-arm64`; the actual CI checkout was
merge commit `786b2e35cf5906f6bde5c12359d61cb4ffb7bbd5`, associated with PR head `13aa68c`.

Investigation found two harness concerns: the parent Vitest process retained a loaded installed
N-API DLL across uninstall, and Squirrel adds an installer helper (`lib/net45/squirrel.exe`,
PE machine 014C) that is absent from the pre-installer app directory. Neither failed cleanup nor
the missing architecture result is waived. Native proof must finish in a subprocess before
uninstall, and any installer-helper architecture exception must verify exact trusted vendor bytes
while leaving application/native payload checks strict. Follow-up evidence remains required.

The follow-up now waits for the isolated native-proof subprocess to close before uninstall, so its
DLL mappings are released. A copied real-addon experiment reproduced deletion denial while its
loading process remained alive and successful deletion after exit. The only mixed-architecture
exception is the root maker-injected `squirrel.exe`, verified byte-for-byte against the pinned
maker dependency's vendor helper; changed bytes, nested helpers, and wrong-architecture application
payload still fail. Bounded failure metadata records remaining paths/types/sizes without retaining
file contents, credentials, or raw assertions. No manual installation cleanup was added.

Hosted CI on `13aa68c` also failed one keyboard journey on x64 and one wizard journey on ARM64.
The tests now wait for the terminal's automatic focus before F6 and for each successful wizard
transition's destination heading/focus. Assertions remain intact, with retries disabled and no
arbitrary sleeps. The focused slice passed 11/11; both affected journeys then passed three independent
runs each (6/6). No hosted trace was available to confirm the exact intermediate focus state.

Local follow-up verification at 22:57 EDT passed 360 unit tests, 264 contracts, typecheck, formatting,
and lint. The queued coordination fix passed the full 41-case E2E suite before the subsequent
keyboard/wizard readiness assertions. Hosted installation and CI must be rerun on the new commit;
the previous failed runs are retained as failed evidence, not retrospectively marked green.

### Hosted installed retry and closure review — 2026-08-30 23:12 EDT

This checkpoint supersedes earlier current-status claims. Source head `56d86095b5933e24160e06527526edde6339ed1c`
passed a fresh full local E2E suite, **41/41**, and CodeQL run `33352516733`.
Installed run `33352518762` tested merge checkout `f4867af772ad7ddf52f0a10e88ecc2f3d66def67`.
Both Windows Server 2025 x64 and Windows 11 Enterprise 26200 ARM64 passed the actual installed
artifact suite, default unsigned policy, exact maker-updater identity, private-persona exclusion,
native proof with subprocess closure, and installed Electron main/session-host/ConPTY/bridge proof.
Reports explicitly leave publisher trust unverified and live provider missions `NOT_RUN`.

**Uninstall still fails on both architectures.** Registration, shortcuts, application/native payload,
processes and session credentials are removed, but `Update.exe` and `app-0.0.0/squirrel.exe` remain
beside the allowed `.dead` tombstone. ARM64 also retained the harness-generated acceptance report.
No residue was manually deleted or added to a passing allowlist. The narrowed result confirms the
native-DLL harness fix but does not close the remaining updater cleanup failure. Curated reports:
`tmp/us8/closure6-hosted-x64` and `tmp/us8/closure6-hosted-arm64`. T154 remains open for cleanup and
supported Windows 11 x64 installed evidence; signing is not a blocker.

Windows CI run `33352518772` initially failed two x64 database cases solely on the unchanged
five-second test limit (358/360 passed), while ARM64 continued. A focused local rerun of those
two files passed 7/7 without code, assertion, retry or timeout changes. The original hosted failure
is retained in `tmp/us8/closure6-ci-x64-failed.log`; any hosted retry must be recorded separately.

The bounded independent follow-up review found no important assertion weakening or privacy defect.
T158 remains open: the spec explicitly requires final closure approval, not merely review with
blockers. It also retains a scope reconciliation: the original task note protects session-host files,
whereas the later content-free byte-meter integration was approved by a root-agent implementation
ruling. No explicit owner exception was found; that ruling is not presented as owner approval and
the preserve-only instruction was not rewritten to excuse the change. No further host edits or
restoration of the separately preserved concurrent changes were made during this review.

Feature 002 remains active at **161/166**. T148/T149/T154/T157/T158, the unchanged **250 MiB** memory
gate (latest measured **380.324 MiB**, median CPU **0%**), exact installed provider/Claude auto-policy
evidence, required independent reviews and human acceptance remain unresolved. PR17 stays draft;
no merge, production release, local Squirrel install or next-feature specification occurred.

The shipped vendor identifies as Squirrel `2.0.1+eef37460ae`. At that exact revision,
[Uninstall](https://github.com/Squirrel/Squirrel.Windows/blob/eef37460ae/src/Update/Program.cs#L255-L264)
runs in place and has no post-exit retry; [FullUninstall](https://github.com/Squirrel/Squirrel.Windows/blob/eef37460ae/src/Squirrel/UpdateManager.ApplyReleases.cs#L96-L143)
suppresses directory-deletion failures before writing `.dead`. The root updater is running during
deletion. Its [executable detector](https://github.com/Squirrel/Squirrel.Windows/blob/eef37460ae/src/Squirrel/SquirrelAwareExecutableDetector.cs#L33-L55)
also reads the versioned helper with Mono.Cecil without disposing the assembly, supporting the
second-file lock explanation; no direct handle trace was captured. No supported existing command
repairs the cleanup gap. A reviewed updater repair or installer change is required, not a test waiver.
Separately, the nested acceptance report now goes directly to the runner report directory instead of
polluting the installation. That hygiene fix does not claim to repair either updater residue.
The report-path fix passed all seven local packaged-artifact cases, typecheck and lint. Its report
was written outside the package at `tmp/us8/closure7-artifact-acceptance.json`; no installer ran.

The initial ARM64 CI job subsequently finished with 39/41 E2E passes: the repaired keyboard and
wizard cases passed, but two coordination lifecycle cases remained queued after a synthetic safe
point. All preceding ARM64 gates, including Windows integration, passed. Those two failures are
retained in `tmp/us8/closure6-ci-failed.log` and are investigated separately from the x64 timeouts.

The exact failed-uninstall Setup artifacts from run `33352518762` are retained by CI (not published
as a release): x64 SHA-256 `d9d70ea113454a7d416944befdd27151cd36ea10de9390c8afaf6b6e5a9d03a1`;
ARM64 SHA-256 `805d368a426bbe415863a790979e6a83fc5e1d66612f88999b6657c1a59aea75`.

The lifecycle investigation found that the queued test-helper conversion also moved fresh event
timestamps from Electron main to the runner process. Main correctly rejects future evidence without
a tolerance. A new real-app regression reproduced rejection/queued delivery with the runner clock
ahead, then passed after the default timestamp moved inside the queued main callback. Explicit
timestamps remain untouched: a deliberate future timestamp is still rejected and cannot deliver.
Both original journeys now assert the ingestion/presentation result before checking UI delivery.
No production freshness rule, safety condition, timeout or retry count changed. This establishes
the harness defect and its correction; no hosted trace was available to prove the precise clock
offset in the failed ARM64 run.
The three affected journeys passed three independent runs each (9/9, retries disabled) after the
focused red/green regression. Typecheck, lint and formatting passed for the final follow-up.

### Owner-approved preview deferrals — 2026-08-31

The owner accepted the recommended unsigned x64 preview package after reviewing which remaining
items were technical blockers versus deferrable quality/process requirements. The authoritative
[preview-release.md](preview-release.md) records D01-D04 and retained gates P01-P05. This approval
changes the preview scope; it is not retroactive test success, full Feature 002 completion, approval
of the session-host scope change, or permission to merge/distribute a candidate.

Deferred from the preview: the 250 MiB idle-memory threshold (latest observation 380.324 MiB),
ARM64 distribution, unproved autonomous-provider capabilities and their full live proof, and the
requirement to obtain every originally named AI review. Substantive independent review and owner
acceptance remain required. Windows 11 x64 installed acceptance, real x64 uninstall cleanup,
session-host scope review, unsigned integrity/fuse checks, privacy and runtime authority controls
remain gates. Existing full-feature checkboxes remain unchanged at 161/166; partial/deferred tasks
are mapped explicitly rather than marked complete. Feature 002 remains selected.

Verified before the scope edit: runtime/test commit `ea4c90675487903c255193dd22c3d39fb95b2010`
passed [Windows x64/ARM64 CI](https://github.com/Lastonedown86/ThreadHelm/actions/runs/33353604610)
and [CodeQL](https://github.com/Lastonedown86/ThreadHelm/actions/runs/33353602108).
The [installed run](https://github.com/Lastonedown86/ThreadHelm/actions/runs/33353604612) tested
merge checkout `a30bf3abd67182e3a8121f44ec555f6d65d578aa`: artifact and containment checks passed,
but cleanup failed on both architectures. x64 retained the updater binaries; ARM64 additionally
retained ThreadHelm.exe, v8_context_snapshot.bin and vk_swiftshader.dll. No remaining processes or
session credentials were observed at the final snapshot. Additional ARM64 residue is not
conclusively attributed to the vendor-only issue. Deferring ARM64 distribution does not erase it.

The current Claude adapter reports only manual/bounded-allowlist policies and unknown organization
policy for its supported surface. The main permission resolver rejects missing, stale, mismatched
or unsupported evidence and requires allowed organization policy for auto. This scope edit changes
no runtime guard, manifest, provider setting, packaging architecture support or CI matrix. There is
no automatic publication workflow; only accepted x64 candidates may be selected for preview release.

Scope-change validation: 93 existing launch-policy/provider/launch-contract checks passed across
three files; formatting, local preview-document links and diff whitespace checks passed. The full
task count remains 161 checked / 5 open. This change edits documentation only: no runtime tests,
CI checks, architecture support or safety assertions were disabled. The full runtime suite was not
rerun for the documentation change; its last complete hosted result is the `ea4c906` run above.

## 2026-08-31 next-feature handoff repairs

The owner requested the work needed to reach the next feature after approving D01-D04. The
specification, roadmap and [transition record](transition-to-next-feature.md) now permit a limited
handoff after retained P01-P05 acceptance, required repository review and main integration. Full
Feature 002 closure is no longer a prerequisite for that route; deferred tasks remain incomplete
and must be carried into the next specification as unmet constraints. The selector remains 002.

Independent review of `659e59b..88ffeaa` found a real worker resource-bound escape: final worker
results could finish the attempt and clear host output limits while the process remained alive.
New regressions reproduced it. Main now stops and independently inspects the exact worker for
every final disposition; unverified closure becomes unknown, and a reported unknown remains
unknown even after verified stop. Result persistence never clears a surviving host's ceiling.
Duplicate results remain idempotent; changed content is rejected. A notification failure cannot
skip teardown or the actionable recovery record. Main's persisted result and supervisor inbox are
authoritative; an in-Job caller may be terminated before receiving its final acknowledgement.
Reusable workers require a separately verified idle protocol rather than a terminal-result claim.

The independent safety reviewer reported no remaining actionable findings in this bounded repair
and independently passed 35 supervisor contracts. Review evidence is retained locally in
`tmp/us8/handoff-review-final.log`; the reviewed production blobs were
`18c95cc18836db27e64fc12032080badf1da0989` (supervisor) and
`17085b4e6d8b0456450d711b7b22bf9adca2b8d5` (session failure cleanup). The original session-host exception
still needs owner reconciliation; independent technical review is not owner or repository approval.

Squirrel's shipped in-place uninstaller has no supported post-exit cleanup switch. The replacement
changes only Forge's maker stage: pinned electron-builder 26.15.3 creates per-user NSIS installers
from Forge's prepackaged directory. Native copying, actual private-Marvel audit, ASAR integrity and
production fuses stay with Forge. The maker verifies unchanged EXE/ASAR bytes and records the exact
generated helper digest; installed acceptance verifies those identities before executing the fixed
uninstaller path. Publishing, elevation, post-install app launch and user-data deletion are disabled.
No Squirrel upgrade/migration or certificate-backed signing is claimed. Optional signing credentials
are captured only inside the callback, outside builder's serialized configuration.

The local unsigned NSIS prototype built successfully (Setup SHA-256
`82ee2e335782d5cd560404891ce30b242db3713c49ec4e7636e46d8301b99bec`). This is build evidence, not the
final accepted candidate or installed acceptance. No installer was run on the owner's account.
The independent installer reviewer accepted the candidate for hosted testing after fixing the
temporary-helper observation and wrapper parameter shadowing. The harness preserves normal `/S`
relocation, bounds TEMP/TMP to the run's directory and includes every process there in cleanup
observation. Its original exit status is explicitly `uninstallLauncherExitCode`; no child exit
code or global TEMP cleanup is invented. Any retained installed entry, including `.dead`, fails.

Local validation at this checkpoint: lint and typecheck passed; 637 unit/contract tests passed;
the real temporary-helper observer test passed. The full Windows run had 95 passed, one existing
skip and one control-order timeout, followed by a clean 13/13 rerun of that entire affected file.
Do not label the first full run green. The new helper test ran separately after the full run's
file discovery. Full E2E and hosted candidate checks remain pending at this checkpoint. Generated
release output and temporary evidence/dependency backups are excluded from lint, without excluding
application or test source. The prior dependency installation was preserved while regenerating a
clean installation after pnpm repeatedly omitted a declared dependency.

## 2026-08-31 NSIS identity, cleanup evidence and compression backport

Full local E2E completed with 42/42 passing after the worker-bound repair. The first hosted NSIS
run, [33362482111](https://github.com/Lastonedown86/ThreadHelm/actions/runs/33362482111), failed because
the acceptance harness assumed a product-name install directory and registration. The pinned
builder instead uses `Programs/@threadhelmdesktop` for one-click per-user installation and the
stable appId-derived GUID. Commit `19752c4` corrected these identities, preserved that GUID
explicitly, and added a regression exercising the real builder naming rule.

The corrected [x64 job](https://github.com/Lastonedown86/ThreadHelm/actions/runs/33363402143/job/99399078238)
passed on Windows Server 2025, merge checkout `64db4ab4018f4ea930e3ff4f9b6f6f42a5e8ad64` from source
head `19752c4`. Unsigned Setup SHA-256:
`5e8c45583ea860d5eb0689f8c9cf857ab6b49cb917a65d4d8d817fd2fc1a2519`.
Installed native/real-bridge and Electron-main/session-host/ConPTY proof passed, as did audited
EXE/ASAR identity, production fuses, private-persona exclusion and native architecture. Normal
uninstall left no observed payload, registration, shortcuts, app/helper processes or session
credentials. The relocated helper was observed and then absent. No manual deletion was used.
Reports are retained locally under `tmp/us8/handoff-identity-x64/` and in that run's artifacts.
This does not establish Windows 11 x64 client acceptance or a live provider mission.

The corresponding ARM64 install omitted native binaries; cleanup nevertheless passed. Its report
is under `tmp/us8/handoff-identity-arm64/`. The symptom matches the vendor's
[NSIS extractor fix](https://github.com/electron-userland/electron-builder/pull/9988),
[backported to maintained v26](https://github.com/electron-userland/electron-builder/pull/9989).
Both builder packages are now pinned to 26.15.7, whose NSIS archive path forces a decoder-compatible
filter. Independent review confirmed the signing callback, helper filename, application identity
and prepackaged behavior remain compatible. No custom filter, vendor patch, signing claim or ARM64
distribution approval was added. This changes installer bytes, so both new artifacts require fresh
actual acceptance; the prior x64 pass must not be attributed to a later artifact.

Initial hosted CI also failed a five-second disk-reopen test and an ARM helper fixture that queried
CIM before proving copied-runtime readiness. The former now allows fifteen seconds with the same
durability/stale-write assertions. Commit `0e9ec1b` adds bounded readiness/exit diagnostics and
parent-requested shutdown to the helper fixture while retaining exact PID/hash and cleanup checks.
Local focused tests, typecheck, lint, formatting and independent review passed. Neither original
failure is relabeled green. Fresh hosted CI and installed results are maintained in PR17.

Readiness succeeded on the next hosted run, but both architectures still missed the live helper
in CIM. A local reproduction with an 8.3 TEMP alias failed identically. Node's regular
`realpathSync` preserves those aliases; `realpathSync.native` expands them to CIM's long image
path. The fixture now canonicalizes its temporary base and root using the native resolver and
validates cleanup against that same base. `realChild` uses the native resolver while retaining
its original lexical and resolved-boundary checks. The exact short-path reproduction then passed
without changing any observation assertion. Logs: `tmp/us8/handoff-helper-short-path-red.log` and
`handoff-helper-short-path-native-green.log`. Hosted verification remains separate.

Fresh local packaged x64 idle measurement at 02:28 EDT: **382.609 MiB peak**, median CPU **0%**
over twelve approximately five-second windows, four application processes, no sessions or inspector
and fresh user data. The executable SHA-256 was
`e8e4becb18348f6ccf08996bcca45f7bb4f52b31b85fbd73ee01413f0f62dfd0`.
CPU passes; memory still exceeds the deferred 250 MiB target. This is not installed acceptance,
four-worker measurement, or a newly approved memory ceiling. Evidence:
`tmp/us8/handoff-packaged-idle-performance.json`.

The selector and five full-feature task checkboxes are unchanged. Retained supported-client proof,
current resource/candidate checks, owner host-scope reconciliation, exact-candidate acceptance and
required repository review remain prerequisites for the next-feature handoff.
