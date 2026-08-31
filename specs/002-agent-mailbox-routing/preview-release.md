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
Verified Mission Delegation may begin with D01-D04 carried forward explicitly. Full Feature 002
closure is no longer a prerequisite for that limited handoff. This does not waive P01-P05 or
mark deferred tasks complete. See [the transition record](transition-to-next-feature.md).

## Approved deferrals

| ID | Decision for this preview | Work retained and condition for restoring the claim |
| --- | --- | --- |
| D01 | Defer the inherited 250 MiB no-session idle-memory target as a preview release gate. Accept the documented 380.324 MiB observation as a known limitation, not a passing measurement or a new ceiling. | Retain the 250 MiB optimization target and fresh packaged measurements. Reassess before a full release. CPU, active-session resource bounds, responsiveness, containment and privacy requirements are unchanged. No shell migration is approved. |
| D02 | Distribute and advertise only Windows 11 x64 preview artifacts. ARM64 distribution and support claims are deferred. | Keep ARM64 implementation and validation tests. ARM64 CI artifacts are diagnostic only, never preview downloads. Restore distribution only after its installed acceptance and cleanup pass and the owner approves expanding support. |
| D03 | Defer the unproved installed autonomous-provider mission capabilities and their full US8 live proof. Do not advertise full US8 readiness. | Claude auto starts remain held; missing, stale or unsupported capability evidence cannot grant authority. Explicit manual and supported bounded-allowlist paths retain their existing checks. No bypass fallback, synthetic policy verdict, broader permission, or recovery autostart is allowed. Restore each deferred capability only after exact-version provider/permission/mission evidence, substantive review and human acceptance. |
| D04 | Replace the requirement to obtain every originally named AI-provider review with substantive independent safety review and owner acceptance. | The reviewer must be independent of the implementation being reviewed and assess the actual diff and evidence. Existing approved-ecosystem limits apply. Named Claude/Antigravity rounds may be requested but are not a preview release prerequisite; this decision does not authorize new credentialed or paid provider runs. |

The 380.324 MiB observation was a local packaged x64 measurement on 2026-08-30, not an installed
Windows 11 acceptance result or an ARM64 measurement. It does not prove absence of future leaks
or regressions. Continue reporting actual measurements without trimming working sets or excluding
application processes. The four-idle-session 700 MiB budget and median idle CPU limit of 1% over
60 seconds are not deferred by D01.

## Retained preview release checklist

- [ ] **P01 — Windows 11 x64 installed acceptance:** Exercise the exact candidate installer on a
  disposable supported Windows 11 x64 client. Record artifact identity, launch/native loading,
  installed bridge lookup, containment, single-instance behavior and applicable preview/manual
  workflows. Windows Server CI cannot satisfy this client-platform requirement.
- [x] **P02 — Installer cleanup:** Actual x64 uninstall verified for candidate `88d1b41` in
  [run 33364588605](https://github.com/Lastonedown86/ThreadHelm/actions/runs/33364588605).
  No remaining executable
  payload, registration, shortcuts, app/bridge processes or session credentials; the documented
  NSIS candidate permits no retained installation entries, including a legacy `.dead` tombstone.
  Do not manually delete residue to manufacture a passing result.
- [ ] **P03 — Independent safety and scope review:** Review the exact candidate diff, preserved
  permission/unknown-outcome boundaries and test evidence. Explicitly resolve the original
  session-host preserve-only instruction versus the later content-free byte-meter change.
  Approval of these deferrals is not approval of that change.
- [ ] **P04 — Candidate controls and evidence:** Confirm x64-only distribution, unsigned signature
  policy (invalid signatures rejected), checksums, production fuses, private Marvel exclusion,
  no unproved automatic starts, retained performance/resource checks and applicable CI on the
  reviewed candidate. Existing passes are evidence, not automatic approval of a later artifact.
- [ ] **P05 — Owner acceptance:** Accept the exact preview candidate and its disclosed limitations
  after P01-P04. Obtain required repository review before merging; distribution remains a separate
  deliberate action.

No installer has been run on the owner's account. Use the existing disposable-runner safety rules;
do not relax them to obtain Windows 11 x64 evidence.

## Full-feature task mapping

| Existing item | Preview treatment |
| --- | --- |
| T151 measurement coverage / idle-memory release target | Coverage remains complete. Only the 250 MiB preview threshold is deferred under D01; keep recording the failure against the full target. |
| T148 installed autonomous mission proof | Deferred under D03, still incomplete. |
| T149 aggregate US8 evidence and acceptance | Mixed: full autonomous-provider proof deferred under D03; independent review and human acceptance retained under P03/P05, with D04 simplifying reviewer assignments. |
| T154 packaging / installed lookup / cleanup | x64 portions retained under P01/P02/P04. ARM64 distribution acceptance deferred under D02; its failures remain recorded. |
| T157 installed-artifact and provider proofs | Preview x64 artifact/manual-workflow evidence retained; unproved autonomous-provider mission proof deferred under D03. Do not relabel fixtures as live provider proof. |
| T158 final feature closure | Remains incomplete until full obligations pass. The separately approved preview handoff may trigger the next feature only after P01-P05, required review and integration on main; carry every deferral forward. |

## Current evidence and remaining work

Candidate `88d1b41` with the NSIS decoder backport passed actual x64 and ARM64 installation,
installed artifact/containment checks and uninstall without manual deletion in run 33364588605.
The exact source/merge/Setup identities are in the [transition record](transition-to-next-feature.md).
The x64 runner was Windows Server 2025, so P01 remains open; ARM64 remains diagnostic under D02.
P02 is complete for this candidate, not a blanket approval of future installer bytes. The prior
Squirrel failures below remain historical evidence rather than current NSIS cleanup failures.

Fresh local packaged idle measurement was 382.609 MiB peak and 0% median CPU over twelve windows.
The four-idle-session 700 MiB requirement still needs supported packaged-client evidence; the
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
The release manifest/download list must contain only accepted x64 artifacts. There is currently no
automatic publication workflow; building or uploading an ARM64 CI diagnostic is not distribution
approval. Private Marvel personas remain excluded from every distributable; optional personal
imports remain local and non-authoritative.
