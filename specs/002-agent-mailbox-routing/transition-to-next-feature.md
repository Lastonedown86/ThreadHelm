# Preview handoff to Verified Mission Delegation

**Owner direction, 2026-08-31:** Do the work needed to reach the next feature, following the
approved unsigned x64 preview deferrals. **State: preparation in progress; not accepted.**

This is an alternative development handoff, not full Feature 002 closure or release approval.
It removes the need to finish D01-D06 before beginning the next specification. All retained
[P01-P05 gates](preview-release.md) still apply, followed by required PR review and integration
of the accepted baseline on main. The feature selector stays on 002 until these gates pass.

## Carry-forward dependency record

| Backlog | Owner and restoration gate | Impact on Verified Mission Delegation |
| --- | --- | --- |
| D01: 250 MiB idle-memory target | Feature 002 performance backlog; fresh packaged measurement below the original threshold before restoring that claim. | Measure actual memory; avoid continuous rendering. Other resource and CPU limits remain mandatory. |
| D02: ARM64 distribution | Feature 002 packaging backlog; ARM64 installed acceptance, cleanup and explicit support expansion. | x64 is the accepted preview target; ARM64 CI remains diagnostic. |
| D03: unproved autonomous-provider capability | Feature 002 T148 and full-proof portions of T149/T157; exact-version permission, mission and human evidence. | Specify verification and receipts over the existing mission foundation. Never treat fixtures, a persona or stored capability history as launch authority. Unsupported starts stay held. |
| D04: originally named AI-provider review rounds | Optional additional review; substantive independent review and owner acceptance replace the named roster for preview. | Preserve separation of duties without requiring or silently launching a paid external provider. |
| D05: 700 MiB four-session aggregate target | Feature 002 performance backlog; calibrate a representative hardware/workload ceiling before restoring a fixed-ceiling claim. | Keep total memory disclosure, CPU/latency, bounded buffers/resources and long-run/session-cycle cleanup evidence. No shell/host rewrite is required merely to pass the deferred ceiling. See [memory-budget review](memory-budget-review.md). |
| D06: 1% four-session median CPU target | Feature 002 performance backlog; calibrate representative hardware, terminal-focus state and workload before restoring a fixed ceiling. Preserve the measured 0.44%-1.76% cycle results as failures against the original target. | Keep no-idle-animation, immediate responsiveness, terminal input/IME/accessibility behavior, full-family accounting, security, containment, cleanup and long-run/session-cycle evidence. Do not relabel the old measurements as passes. |

T148, T149, T154 and T157 remain open full-feature/deferred tasks; T158 drift review is complete.
T173 completed the extended preview resource verification. T174 retains the fixed CPU remediation
and calibration backlog under D06; it is not complete and its historical failures remain recorded.
The earlier [resource checkpoint](t173-resource-checkpoint.md) is superseded by the
[completed candidate follow-up](t173-candidate-follow-up.md). P04 now requires exact-candidate
repository/CI evidence rather than a pass against the deferred fixed CPU ceiling.
The next feature must link this
record and identify which deferred capabilities its acceptance scenarios require. If an increment
depends on unproved live automation, that scenario stays blocked until the original proof passes;
do not duplicate or bypass the capability gate in the new feature.

## Candidate acceptance record

Populate these fields from completed evidence, not from intended actions:

| Required record | Current state |
| --- | --- |
| Candidate source commit and installer SHA-256 | Application/evidence candidate committed at `d23d297` from base `3c574fb19db4ea0a1af2fdffc8b8c1ee8ced3e56`; unsigned x64 Setup `56bece9651851b668d9efc2689f2aadda566bbb13ddc7d896c6d825b5d290f97`. A documentation-only identity follow-up may become the PR head without changing application bytes. |
| P01: Windows 11 x64 installed/manual acceptance | Complete. Exact changed candidate installed after a fresh verified backup; installed identity, bridge lookup, native containment, single-instance behavior and visible current generic template content passed. No provider mission was started or counted as evidence. |
| P02: actual uninstall with no executable residue | Passed for source 0745294 / tested merge 5e96e73ca968f5a6651048f95ca1e2239245c23a in run 33406139286. Tested hosted x64 Setup 47271ee3bc7ba5a16006cd332f924f6c07b4c5477801651a26865e97b4d2fb17; no manual deletion. This is distinct from the locally installed Setup. |
| P03: independent safety review and host scope reconciliation | Complete. Technical review passed and the owner approved the exact bounded three-file host exception on 2026-08-31. |
| P04: x64 candidate controls and applicable CI | Static controls, unsigned policy, x64 payload, private-persona exclusion and extended cleanup evidence pass. D06 preserves the failed CPU measurements while deferring the fixed preview threshold. Exact-candidate repository/CI evidence remains pending. |
| P05: owner acceptance of exact candidate and limitations | Pending P04 |
| Required repository review and main integration | PR17 draft; no approval or merge recorded |

The initial NSIS Setup exited successfully on x64 and ARM64, but the harness looked for
`Programs/ThreadHelm` instead of `Programs/@threadhelmdesktop`. The corrected harness uses the
explicit stable installer GUID and the pinned builder's package-name rule. Hosted x64 CI also
exceeded a five-second disk-reopen test timeout; that persistence test now allows fifteen seconds
without changing its recovery or stale-write assertions. Fresh hosted results must replace these
failed runs before acceptance.

The corrected identity run passed x64 installed/cleanup checks. ARM64 installed data files but
omitted native binaries, matching a vendor extractor bug. Both builder packages are now pinned
to the maintained v26 backport, 26.15.7; fresh artifact results are tracked in PR17 and the
[execution record](execution-evidence.md). ARM64 distribution remains deferred.

The maintained-backport run 33364588605 subsequently passed both architectures, including actual
installed native and Electron/session-host/ConPTY containment and clean uninstall. Tested merge
checkout: `3d6fe256ee455dbdf7af1a1568b4df7104fd26ae`. Its historical x64 Setup digest is
`6452f3a870b45aef46c0822f35a729ade2dd5857843937ec892fa9b44cd71634`; diagnostic ARM64
Setup digest is `bd46ca08313fd5d6af46b12d07177e075dc8c99a1abe49cba00e150c5b14cbf4`.
Both reports explicitly leave provider mission proof unrun. ARM success does not expand distribution.

Standard hosted x64 installer evidence is from Windows Server and alone does not satisfy P01's Windows 11
x64 client requirement. The owner subsequently authorized normal installation on their Windows 11 Home
x64 machine instead of a VM. The app-data backup and installed checks are recorded in the execution
record; manual workflow/resource acceptance is still separate. The destructive install/remove harness
was not used and its guards remain unchanged. No runner metadata was spoofed or paid runner provisioned.

The proposed bounded host exception for review is the content-free output meter, its budget
messages, resume guards and truncation disclosure. It does not authorize other host refactoring,
resize changes, permission expansion or recovery replay. The original unrelated keystroke work
is preserved separately on `codex/recovery-002-pre-scope-split` at
`ef448067dd0b554127e6bf17605e596e7f2c0d60`, not incorporated into this candidate.

**Approved owner exception — 2026-08-31:** Permit only the reviewed content-free output-meter
changes in `apps/desktop/src/session-host/index.ts`, `backpressure.ts`, and `output-meter.ts` as
present in candidate base `3c574fb19db4ea0a1af2fdffc8b8c1ee8ced3e56`. Their exact Git blobs are
`83805c915d9c19d271c079434b53356a2f4f5149`,
`dcd80f85bd8b0402329b60aed08dc93f93d4637f`, and
`62a3218c279b0671ae624a8cdcf07e3cf9940461`; each is unchanged from its reviewed introduction at
`da3dc66`. The purpose is to enforce per-attempt output bounds inside the trusted host, prevent
resume from bypassing an exhausted bound, and report truncation without sending terminal content
to main. `resize.ts` remains unchanged at blob `eaafd54cf612696ee8a18a2ac48f064872741a99`.
This approval is limited to integrating this Feature 002 preview candidate: it grants no standing
permission for future host edits and expires for new work when this candidate is merged or
superseded. Any broader/different change requires fresh owner review. This exception does not
approve provider starts, merge, distribution, final candidate acceptance, or the deferred capabilities.

## Next-spec request after acceptance

Use the next available feature number at invocation, without precreating a spec directory:

```text
$speckit-specify Create Verified Mission Delegation from docs/roadmaps/verified-mission-os.md.
Verify the accepted Feature 002 preview handoff and carry forward D01-D06 from its transition record.
Reuse US8 mission envelopes, exact launch bindings, work DAGs, leases, structured returns and recovery.
Specify criterion-level evidence, Capability Passports, progress accountability, Mission Receipts,
and Mission Focus. Distinguish local verified results from future GitHub-confirmed PR readiness.
Do not add GitHub intake/delivery, automatic issue starts, merge or deployment in this feature.
```

GitHub Mission Intake remains a separate later feature. No repository review, owner acceptance,
installer distribution, credentialed provider run or paid runner provisioning is implied here.
