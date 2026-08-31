# Approved unsigned x64 preview scope

**Decision date:** 2026-08-31. **Authority:** The owner accepted the recommended deferral package
after asking which remaining blockers were essential. **Status:** Scope approved; installer
distribution and final acceptance are not yet approved.

This is a limited preview milestone within Feature 002, not completion of all US8 capabilities.
It supersedes earlier statements that every full-feature gate must pass before this preview.
The full-feature task ledger stays intact: deferred work is not marked complete, Feature 002
remains selected until the recorded handoff below. Scope approval alone does not approve a merge,
release, or candidate acceptance.

**Sequencing decision, 2026-08-31:** The owner subsequently requested the work needed to reach the
next feature. After the retained P01-P05 gates, required repository review and integration on main,
Verified Mission Delegation may begin with D01-D06 carried forward explicitly. Full Feature 002
closure is no longer a prerequisite for that limited handoff. This does not waive P01-P05 or
mark deferred tasks complete. See [the transition record](transition-to-next-feature.md).

## Approved deferrals

| ID | Decision for this preview | Work retained and condition for restoring the claim |
| --- | --- | --- |
| D01 | Defer the inherited 250 MiB no-session idle-memory target as a preview release gate. Accept the documented 380.324 MiB observation as a known limitation, not a passing measurement or a new ceiling. | Retain the 250 MiB optimization target and fresh packaged measurements. Reassess before a full release. CPU, active-session resource bounds, responsiveness, containment and privacy requirements are unchanged. No shell migration is approved. |
| D02 | Distribute and advertise only Windows 11 x64 preview artifacts. ARM64 distribution and support claims are deferred. | Keep ARM64 implementation and validation tests. ARM64 CI artifacts are diagnostic only, never preview downloads. Restore distribution only after its installed acceptance and cleanup pass and the owner approves expanding support. |
| D03 | Defer the unproved installed autonomous-provider mission capabilities and their full US8 live proof. Do not advertise full US8 readiness. | Claude auto starts remain held; missing, stale or unsupported capability evidence cannot grant authority. Explicit manual and supported bounded-allowlist paths retain their existing checks. No bypass fallback, synthetic policy verdict, broader permission, or recovery autostart is allowed. Restore each deferred capability only after exact-version provider/permission/mission evidence, substantive review and human acceptance. |
| D04 | Replace the requirement to obtain every originally named AI-provider review with substantive independent safety review and owner acceptance. | The reviewer must be independent of the implementation being reviewed and assess the actual diff and evidence. Existing approved-ecosystem limits apply. Named Claude/Antigravity rounds may be requested but are not a preview release prerequisite; this decision does not authorize new credentialed or paid provider runs. |
| D05 | Following the memory prototype and budget reassessment, defer the inherited 700 MiB four-idle-session aggregate ceiling as a preview release gate. The measured 1,427.305 MiB remains a failure against that target, not a passing result or a new ceiling. | Retain 700 MiB as an optimization target; calibrate a realistic hardware/workload-specific ceiling under the memory-budget review. Keep complete process accounting, CPU/latency checks, buffer/process/mission bounds, long-run/session-cycle evidence and cleanup. No production host/shell rewrite is required merely to meet this deferred target. |
| D06 | Following T173's five-cycle failure and T174's focused-terminal diagnosis, defer the fixed 1% four-session median one-core CPU threshold as a preview release gate. The measured 0.44%-1.76% cycle results remain failures against the original target. | Retain CPU calibration work with representative hardware, workload and terminal-focus conditions. Keep no-idle-animation, responsiveness, keyboard/IME/accessibility behavior, complete process accounting, security, containment, cleanup and long-run/session-cycle evidence. Do not relabel the failed measurements as passes. |

The 380.324 MiB observation was a local packaged x64 measurement on 2026-08-30, not an installed
Windows 11 acceptance result or an ARM64 measurement. It does not prove absence of future leaks
or regressions. Continue reporting actual measurements without trimming working sets or excluding
application processes. D01 alone did not defer the four-idle-session 700 MiB budget; the later
owner-approved D05 decision now defers that fixed ceiling for preview. The later D06 decision
defers the fixed four-session CPU ceiling while preserving its failed measurements and qualitative
safety, accessibility and responsiveness gates. None of these decisions changes runtime-enforced
memory, process, output or mission bounds. See [the memory-budget review](memory-budget-review.md).

## Retained preview release checklist

- [x] **P01 — Windows 11 x64 installed acceptance:** Exercise the exact candidate installer on a
  supported Windows 11 x64 client. The owner's explicit 2026-08-31 request authorizes normal
  installation on their machine with app-data backup instead of a VM. Record artifact identity, launch/native loading,
  installed bridge lookup, containment, single-instance behavior and applicable preview/manual
workflows. Windows Server CI cannot satisfy this client-platform requirement.
  Completed on 2026-08-31 for the changed T173 package: unsigned Setup SHA-256
  `56bece9651851b668d9efc2689f2aadda566bbb13ddc7d896c6d825b5d290f97` installed with exit 0
  after a new 50-file/two-shortcut verified backup. Installed EXE, ASAR and uninstaller matched
  the candidate identity; native bridge lookup and the full containment/handle-close proof passed;
  a second launch exited 0 while the original controller remained live. The visible installed UI
  showed all six current bundled revision-2 templates and the generic
  `threadhelm/agent-profile@1` sample. No provider mission was started or counted as evidence.
- [x] **P02 — Installer cleanup:** Actual x64 uninstall verified for source `0745294`, tested merge
  `5e96e73ca968f5a6651048f95ca1e2239245c23a`, in
  [run 33406139286](https://github.com/Lastonedown86/ThreadHelm/actions/runs/33406139286).
  Tested x64 Setup SHA-256 is `47271ee3bc7ba5a16006cd332f924f6c07b4c5477801651a26865e97b4d2fb17`.
  This hosted artifact is distinct from the owner's locally built installer. There was no remaining executable
  payload, registration, shortcuts, app/bridge processes or session credentials; the documented
  NSIS candidate permits no retained installation entries, including a legacy `.dead` tombstone.
  Do not manually delete residue to manufacture a passing result.
- [x] **P03 — Independent safety and scope review:** Review the exact candidate diff, preserved
  permission/unknown-outcome boundaries and test evidence. Explicitly resolve the original
  session-host preserve-only instruction versus the later content-free byte-meter change.
  Approval of these deferrals is not approval of that change.
  **Complete:** the three approved host files match their
  independently reviewed Git blobs, `resize.ts` is unchanged, the current renderer delta has no
  independent review finding, and fresh focused verification passed 173 unit/contract, 32 Rust,
  and 31 Windows integration cases. The review found no permission expansion, unknown-outcome
  replay, raw-terminal-content path to main, private-persona production inclusion or unproved
  automatic provider start. On 2026-08-31 the owner approved the exact bounded exception in the
  transition record. It grants no standing permission for later host edits and does not approve
  provider starts, merge, distribution, P04, P05 or deferred capabilities.
- [x] **P04 — Candidate controls and evidence:** Confirm x64-only distribution, unsigned signature
  policy (invalid signatures rejected), checksums, production fuses, private Marvel exclusion,
  no unproved automatic starts, retained performance/resource checks and applicable CI on the
  reviewed candidate. Include the long-run/session-cycle evidence and memory disclosure defined
  in the memory-budget review. D01/D05 defer fixed aggregate memory ceilings; D06 defers the fixed
  four-session CPU ceiling while retaining the measured failures and qualitative safety/UX gates.
  Existing passes are evidence, not automatic approval of a later artifact.
  **Complete for application candidate `d23d297` / PR head `ea33076`:** [CI run
  33451269519](https://github.com/Lastonedown86/ThreadHelm/actions/runs/33451269519),
  [CodeQL run
  33451267094](https://github.com/Lastonedown86/ThreadHelm/actions/runs/33451267094) and
  [installed acceptance run
  33451269522](https://github.com/Lastonedown86/ThreadHelm/actions/runs/33451269522) passed. The
  tested hosted merge was `f80d60b3ae5c40627d2e20284217c875175e63ef`; its unsigned x64 Setup
  SHA-256 is `2eef36569824bb35c009e8d58c605c5d64eedb0a899faf13a8dacd394c8369a7`.
  Hosted x64 install, fuses, native architecture, private-persona exclusion, bridge/session-host/
  ConPTY containment, single-instance behavior and actual uninstall cleanup passed without manual
  deletion. All CodeQL analyses and both CI architectures passed. ARM64 installed evidence also
  passed but remains diagnostic under D02 and does not expand distribution.
- [ ] **P05 — Owner acceptance:** Accept the exact preview candidate and its disclosed limitations
  after P01-P04. Obtain required repository review before merging; distribution remains a separate
  deliberate action.

The owner explicitly requested installation on their existing machine on 2026-08-31. The tested
x64 candidate was installed normally after a verified app-data backup; the older Squirrel
installation was left intact. This exception does not enable the destructive CI acceptance
harness on a personal account: its disposable-runner guards remain unchanged. No local uninstall
was run. The owner subsequently explicitly approved four idle Codex sessions with eight contained
processes each and the file/network disclosure; their results are below. This is not final
candidate acceptance or release approval.

## Full-feature task mapping

| Existing item | Preview treatment |
| --- | --- |
| T151 measurement coverage / idle-memory release target | Coverage remains complete. The 250 MiB and 700 MiB aggregate preview ceilings are deferred under D01/D05, and the fixed 1% four-session CPU ceiling is deferred under D06; keep recording failures against all original targets and retain the remaining performance evidence. |
| T148 installed autonomous mission proof | Deferred under D03, still incomplete. |
| T149 aggregate US8 evidence and acceptance | Mixed: full autonomous-provider proof deferred under D03; independent review and human acceptance retained under P03/P05, with D04 simplifying reviewer assignments. |
| T154 packaging / installed lookup / cleanup | x64 portions retained under P01/P02/P04. ARM64 distribution acceptance deferred under D02; its failures remain recorded. |
| T157 installed-artifact and provider proofs | Preview x64 artifact/manual-workflow evidence retained; unproved autonomous-provider mission proof deferred under D03. Do not relabel fixtures as live provider proof. |
| T158 final feature closure | Remains incomplete until full obligations pass. The separately approved preview handoff may trigger the next feature only after P01-P05, required review and integration on main; carry every deferral forward. |

## Current evidence and remaining work

**Current local installed candidate:** `0745294c08ed5bb618eb078fbb791dfbe4eac0ad`, x64 Setup
`f6583622701ea57ccf5bc030345716a150424fa561feb05e9b062c345d36c00e`. T169 fixes premature renderer
output subscription during host startup. The unsigned update exited zero after a fresh verified
49-file app-data backup and two shortcut backups. Installed EXE, ASAR and uninstaller identities
matched the build; installed native/session-host/ConPTY/bridge containment passed. No local
uninstall was performed. The prior Squirrel installation and owner data were preserved.

The owner-authorized four-session observation on Windows 11 Home x64 completed twelve windows
over 64.13 seconds: **1,461.383 MiB peak aggregate working set and 17.464% median one-core CPU**.
Both retained budgets failed (700 MiB and 1%). All sixteen app/provider/helper processes were
included with unchanged identities, no trimming or exclusions. The four Codex 0.151.0 sessions
used manual permissions, CLI-default model/effort and eight contained processes each in separate
disposable folders. They remained at provider folder-trust prompts: no prompt, trust confirmation,
mission or work was submitted. This is startup-idle evidence, not provider-ready mission proof.
The first observation was aborted when the process family changed; it produced no verdict.
All four sessions subsequently stopped normally with exit zero, and their twelve processes exited.
That CPU attribution is superseded by the disconnected-inspection measurement below; the
historical observation is retained rather than relabeled as a valid unobserved idle sample.

**2026-08-31 CPU diagnosis and repeat:** The Windows CPU trace and a disconnect/reattach
experiment identified UI inspection accessibility/COM overhead. No production runtime change
was needed. With inspection disconnected, the same installed candidate and four fresh authorized
idle Codex sessions measured **0.588% median one-core CPU (PASS)** and **1,427.305 MiB peak
aggregate working set (FAIL)** over twelve windows / 63.83 seconds. All sixteen processes were
included with stable identities and unchanged budgets. An earlier repeat rejected changing
startup membership and produced no verdict. The four sessions stopped normally with exit zero
through Stop all sessions and exit; all twelve provider/host/helper processes and the main app
exited, then the installed app was reopened without starting a provider.

At that checkpoint, P04 remained blocked by the **700 MiB memory requirement**, not the superseded
CPU attribution. D05 subsequently removed that fixed ceiling from the preview gate; P04 remains
open for retained evidence and candidate review, not automatically passed by this scope change.
After reopening the same installed app with no sessions and disconnecting inspection, twelve
windows measured **0% median CPU (PASS)** and **403.934 MiB peak working set**. The original
250 MiB no-session memory target still fails and remains deferred only under D01.
The [observer procedure](../../tests/acceptance/helpers/measure-installed-idle.md) and
[updated architectural assessment](../../docs/architecture/desktop-shell-reassessment.md)
record the remedy boundary. No memory exclusion, working-set trimming, accessibility disabling,
host refactoring, shell migration, budget waiver, reinstall or release approval occurred during
that measurement. The later D05 decision is a documented scope revision, not a measurement change.

At source `0745294`, local verification passed 647 unit/contract cases and all 42 E2E cases.
Independent review of T169 found no actionable issues. Hosted CI `33406139237`, CodeQL
`33406136909`, and installed acceptance `33406139286` passed, including both architectures.
Hosted x64 cleanup is recorded in P02; its Setup differs from the locally installed bytes.
Private-persona exclusion, production fuses and unsigned policy passed in hosted installed checks.
ARM64 remains diagnostic; both provider mission gates remain `NOT_RUN`. P01 broader manual/exact
release-artifact acceptance, P03 owner host-scope exception and P05 owner acceptance were still open
at that historical checkpoint. P03 is now complete; P04 and P05 remain open.

**Historical installed candidate:** `f53441ee58b9326cfb5d615d34adeb7da80b0e22`, x64 Setup
`06c0284d2fa39aa0bea196c1f7b23c2f911b519c872b541226e5b74971c567ef`. The owner-authorized update
completed on Windows 11 Home x64 after a fresh verified 49-file backup and two shortcut backups.
Installed EXE, ASAR and NSIS helper hashes matched the build identity. The actual app displayed
`threadhelm/agent-profile@1` in the documentation starter, with all six bundled starters at revision 2.
Static installed controls and the separate Electron/session-host/ConPTY/bridge containment diagnostic
passed. The adjacent installed-EXE checksum scenario was skipped (no sidecar); Setup and installed
identity hashes were independently verified. No new live provider, uninstall or four-session
resource acceptance was performed. Historical results below are not evidence for these Setup bytes.

The previous PR head `0758483` passed x64 CI, CodeQL and both installed-acceptance jobs, but ARM64 CI
failed one keyboard-navigation E2E case (41 passed). T168 adds observable readiness waits; the
original failure did not reproduce in twelve x64 repetitions. Independent review passed. Fresh
CI run `33402598473` at `4160352` passed on x64 and ARM64: each passed 42 E2E cases and 97 Windows
integration cases (one opt-in case skipped). CodeQL also passed. This test-only change does not
alter the installed application or establish the original intermittent failure's root cause.

Fresh installer acceptance for source `4160352` passed on both architectures in run `33402598472`:
installation, installed native/session-host containment, signature/fuses/private-persona controls,
and actual uninstall with no executable entries, registrations, shortcuts, processes or credentials
left behind. No manual residue deletion was used. ARM64 remains diagnostic; both reports leave
provider mission proof `NOT_RUN`. The x64 runner is Windows Server, so the hosted run does not
establish Windows 11 x64 manual or resource acceptance. Local installed observation separately
recorded 420.199 MiB peak and 0% median one-core CPU across twelve approximately five-second windows;
the same four app processes remained, with only two stopped session records before and after.
This owner-instance observation does not replace four-session evidence or pass the original
700 MiB target; D05 now defers only that target's preview ceiling.

Candidate `88d1b41` with the NSIS decoder backport passed actual x64 and ARM64 installation,
installed artifact/containment checks and uninstall without manual deletion in run 33364588605.
The exact source/merge/Setup identities are in the [transition record](transition-to-next-feature.md).
The x64 runner was Windows Server 2025, so P01 remains open; ARM64 remains diagnostic under D02.
P02 is complete for this candidate, not a blanket approval of future installer bytes. The prior
Squirrel failures below remain historical evidence rather than current NSIS cleanup failures.

Fresh local packaged idle measurement was 382.609 MiB peak and 0% median CPU over twelve windows.
At that historical checkpoint the four-idle-session 700 MiB requirement still needed supported packaged-client evidence; the
development/inspector x64 CI observation was 790 MiB and is not a release-budget pass.
Candidate CI and CodeQL passed on both architectures; the exact run evidence is recorded below.

At runtime/test commit `ea4c90675487903c255193dd22c3d39fb95b2010`, x64/ARM64 Windows CI and CodeQL
passed; local verification included 360 unit, 264 contract and 42 E2E cases. Actual installed
artifact and native/Electron containment checks passed on Windows Server x64 and Windows 11 ARM64.
Uninstall failed on both: x64 retained updater binaries; the latest ARM64 run also retained
application files. These failures are not waived. See [PR17](https://github.com/Lastonedown86/ThreadHelm/pull/17)
and [execution evidence](execution-evidence.md).

The immediate retained work is real Windows 11 x64 installed/manual and retained resource
acceptance, independent review including the session-host scope decision, and owner acceptance.
The [T173 checkpoint](t173-resource-checkpoint.md) adds a 15m57s installed idle observation,
one four-fixture pilot with clean process cleanup, and fresh static controls. It is superseded for
the changed candidate by the completed follow-up below and does not complete P04.
The [later candidate follow-up](t173-candidate-follow-up.md) fixes stale control status and
terminal focus stealing, records local regression tests and independent renderer review, and
builds a changed unsigned x64 package without replacing the owner installation. Its completed
five-cycle run showed clean process cleanup and no accumulating working-set growth, but active
median one-core CPU failed the retained 1% limit in three of five cycles (1.03%, 1.76%, 1.47%).
T174 retains CPU remediation and calibration under D06. P04 now awaits exact-candidate repository
and CI evidence rather than a pass against the deferred fixed CPU ceiling. Historical
installed/hosted results must not be treated as results for these changed package bytes.
The release manifest/download list must contain only accepted x64 artifacts. There is currently no
automatic publication workflow; building or uploading an ARM64 CI diagnostic is not distribution
approval. Private Marvel personas remain excluded from every distributable; optional personal
imports remain local and non-authoritative.
