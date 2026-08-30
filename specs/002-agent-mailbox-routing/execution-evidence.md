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
| US5 Shared hive memory | Antigravity `gemini-3.1-pro-high` | `gemini-3.7-flash-medium` | Claude `claude-opus-5` / `high` | VERIFIED 2026-08-29 | IMPLEMENTATION ASSIGNED; REVIEW PENDING |
| US6 Reviewed agent roster | Claude `claude-sonnet-5` / `high` | `claude-opus-5` / `high` | OpenAI `gpt-5.6-sol` / `high` | UNVERIFIED | PENDING |
| US7 Agent wizard/templates | Antigravity `gemini-3.7-flash-medium` | `gemini-3.6-flash-medium` | Claude `claude-sonnet-5` / `high` | UNVERIFIED | PENDING |
| US8 Autonomous supervisor | OpenAI `gpt-5.6-sol` / `max` | `gpt-5.6-terra` / `max` | Claude `claude-opus-5` / `xhigh` + human + Antigravity `gemini-3.1-pro-high` | UNVERIFIED | PENDING |

## Command evidence

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
| 2026-08-29 | T062 US4 domain policy red | `pnpm exec vitest run --project unit tests/unit/domain/coordination.test.ts` | 1 | Six intended failures at the absent `evaluateAutomaticContinuation` policy cover depth eight/ninth hold, third exact repeat within eight, third consecutive failure, allowed/held message kinds, paused/closed late messages, opt-in, conflict, and authority. Ten prior domain tests remained green. | EXPECTED RED |
| 2026-08-29 | T063 US4 contract red | `pnpm exec vitest run --project contract tests/contract/desktop-ipc-coordination.test.ts` | 1 | Three intended failures for absent strict auto-continue disclosure/confirmation, escalation/disposition schemas, and named operations. Fourteen prior coordination contract tests remained green. | EXPECTED RED |
| 2026-08-29 | T063 US4 E2E red | Focused Playwright `bounded coordination|authority escalation` | 1 | The first journey timed out at the absent enable-disclosure control; the second failed at the absent `coordination.previewAutoContinue` operation. Both failures occurred at the intended missing US4 surfaces. | EXPECTED RED |

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
- Gemini Pro consumes the scarcer five-hour/weekly quota and is reserved for the contract-sensitive
  implementation. Flash Medium is the quota-preserving fallback, but was not invoked because the
  primary is available; it must be rechecked before use if the primary later becomes unavailable.
- Claude Code 2.1.251 is authenticated through the first-party service. An exact tool-free one-turn
  probe resolved canonical `claude-opus-5` at `high` and returned
  `THREADHELM_US5_REVIEWER_AVAILABLE`. It remains independent and must not implement the slice it
  reviews at T088.
- Deterministic domain, persistence, contract, Windows, E2E, quota, and privacy tests own acceptance.
  The reviewer must independently inspect scope derivation, immutable attribution, conflict
  preservation, content-free lineage, FTS deletion, bounded excerpts/results, and the absence of
  terminal, transcript, reasoning, credential, environment, or workspace-file ingestion.

## Story checkpoints

| Story | Unit/domain | Persistence | Contract | Windows integration | E2E | Provider/installed proof | Independent review | Human gate | Overall |
|---|---|---|---|---|---|---|---|---|---|
| US1 | PASS | PASS | PASS | PASS | PASS | N/A — FIXTURES | PASS — CLAUDE OPUS APPROVED | N/A | MVP PASS |
| US2 | PASS | PASS | PASS | PASS | PASS | PASS — LOCAL/PACKAGED, NO LIVE PROVIDER CALL | PASS — CLAUDE SONNET APPROVED | N/A | US2 PASS |
| US3 | PASS — SERVICE POLICY | PASS | PASS | PASS | PASS | PASS — EXACT CODEX/CLAUDE MANUAL-ONLY PROOFS | PASS — OPENAI SOL APPROVED | N/A | US3 PASS |
| US4 | PASS | PASS | PASS | PASS | PASS | N/A — FIXTURES | PASS — CLAUDE OPUS APPROVED | PASS — PR #10 OWNER APPROVED | US4 PASS |
| US5 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | N/A | NOT READY |
| US6 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | CONFIRM IMPORT | NOT READY |
| US7 | PENDING | PENDING | PENDING | PENDING | PENDING | N/A | PENDING | CONFIRM SAVE/EXPORT | NOT READY |
| US8 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING | NOT READY |

## Release gates

| Gate | Local status | Hosted/external status | Evidence or blocker |
|---|---|---|---|
| Formatting | PASS | N/A | Scoped US3 Prettier check plus prior full `pnpm format`. |
| Lint | PASS | N/A | Full `pnpm lint` after US3 lifecycle changes. |
| Rust format/check/test | PASS | N/A | Format, clippy with warnings denied, 17 supervisor tests, and 8 bridge tests passed. |
| Typecheck | PASS | N/A | Full `pnpm typecheck` after US3 lifecycle changes. |
| Unit tests | PASS | N/A | Full suite: 17 files, 121 tests. |
| Contract tests | PASS | N/A | Full suite: 8 files, 150 tests; focused US3 provider lifecycle after transport remediation 12/12. |
| Desktop build | PASS | N/A | Main, preload, and renderer built. |
| Windows supervision proof | PASS — LOCAL X64 | N/A | Exact real native bridge PID containment proof passes; full serialized integration: 12 files, 42 passed, 1 intentional skip. |
| Windows integration | US1 + US2 + US3 FIXTURE SLICES PASS | N/A | Focused coordination delivery 13/13, including exact-version fixture safe points, real named-pipe EOF degradation, recipient isolation, and fail-closed power/provider paths. |
| E2E | US1 + US2 + US3 + LAUNCH-POLICY SLICES PASS | N/A | Full coordination file 6/6 plus the prior model/effort launch journey. |
| Packaged installed artifact | PASS — LOCAL X64, UNSIGNED | N/A | Provider smoke 3/3 and installed-app acceptance 5/5; bridge present in ASAR-unpacked signed-path location, but no signing certificate was configured. |
| Codex live provider | PASS — MANUAL-ONLY | N/A | Authenticated exact Codex CLI 0.150.1 proof found no pending-draft/editor safety field; automatic presentation remains disabled. |
| Claude live provider | PASS — MANUAL-ONLY | N/A | Authenticated exact Claude Code 2.1.251 Stop-hook proof found no pending-draft/editor safety field; automatic presentation remains disabled. |
| Hosted CI | PASS — PR #10 | PASS — X64, ARM64, CODEQL | PR #10 head `79247d3`: Windows x64 and ARM64 CI plus Actions, JavaScript/TypeScript, and Rust CodeQL completed successfully before merge. |
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

## Rollback and recovery notes

- Coordination schema changes are forward migrations; retain a pre-migration database backup for
  manual recovery until the migration and restart suite passes.
- Startup never replays unknown terminal, export, or supervisor effects.
- Disable unproved provider automation per provider/version and retain the manual path.
- A failed story gate stops advancement to dependent phases; completed earlier milestones remain
  independently usable and are not relabeled as passing later gates.
