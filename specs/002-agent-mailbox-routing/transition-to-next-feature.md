# Preview handoff to Verified Mission Delegation

**Owner direction, 2026-08-31:** Do the work needed to reach the next feature, following the
approved unsigned x64 preview deferrals. **State: preparation in progress; not accepted.**

This is an alternative development handoff, not full Feature 002 closure or release approval.
It removes the need to finish D01-D04 before beginning the next specification. All retained
[P01-P05 gates](preview-release.md) still apply, followed by required PR review and integration
of the accepted baseline on main. The feature selector stays on 002 until these gates pass.

## Carry-forward dependency record

| Backlog | Owner and restoration gate | Impact on Verified Mission Delegation |
| --- | --- | --- |
| D01: 250 MiB idle-memory target | Feature 002 performance backlog; fresh packaged measurement below the original threshold before restoring that claim. | Measure actual memory; avoid continuous rendering. Other resource and CPU limits remain mandatory. |
| D02: ARM64 distribution | Feature 002 packaging backlog; ARM64 installed acceptance, cleanup and explicit support expansion. | x64 is the accepted preview target; ARM64 CI remains diagnostic. |
| D03: unproved autonomous-provider capability | Feature 002 T148 and full-proof portions of T149/T157; exact-version permission, mission and human evidence. | Specify verification and receipts over the existing mission foundation. Never treat fixtures, a persona or stored capability history as launch authority. Unsupported starts stay held. |
| D04: originally named AI-provider review rounds | Optional additional review; substantive independent review and owner acceptance replace the named roster for preview. | Preserve separation of duties without requiring or silently launching a paid external provider. |

The five remaining full-feature task checkboxes remain open. The next feature must link this
record and identify which deferred capabilities its acceptance scenarios require. If an increment
depends on unproved live automation, that scenario stays blocked until the original proof passes;
do not duplicate or bypass the capability gate in the new feature.

## Candidate acceptance record

Populate these fields from completed evidence, not from intended actions:

| Required record | Current state |
| --- | --- |
| Candidate source commit and installer SHA-256 | Pending final reviewed build |
| P01: disposable Windows 11 x64 installed/manual acceptance | Pending supported client environment and exact candidate proof |
| P02: actual uninstall with no executable residue | Pending corrected NSIS harness run; initial hosted run 33362482111 missed the package-name directory and GUID registration. No cleanup pass claimed. |
| P03: independent safety review and host scope reconciliation | Worker-bound/recovery fixes passed independent review. Owner exception remains pending. |
| P04: x64 candidate controls and applicable CI | Revalidate after runtime and installer changes |
| P05: owner acceptance of exact candidate and limitations | Pending P01-P04 |
| Required repository review and main integration | PR17 draft; no approval or merge recorded |

The initial NSIS Setup exited successfully on x64 and ARM64, but the harness looked for
`Programs/ThreadHelm` instead of `Programs/@threadhelmdesktop`. The corrected harness uses the
explicit stable installer GUID and the pinned builder's package-name rule. Hosted x64 CI also
exceeded a five-second disk-reopen test timeout; that persistence test now allows fifteen seconds
without changing its recovery or stale-write assertions. Fresh hosted results must replace these
failed runs before acceptance.

Standard hosted x64 installer evidence is from Windows Server and does not satisfy P01's Windows 11
x64 client requirement. No disposable client environment is confirmed yet. Do not run the destructive
install/remove harness on the owner's normal account, spoof hosted-runner metadata, or provision a
paid runner without separate authorization.

The proposed bounded host exception for review is the content-free output meter, its budget
messages, resume guards and truncation disclosure. It does not authorize other host refactoring,
resize changes, permission expansion or recovery replay. The original unrelated keystroke work
is preserved separately on `codex/recovery-002-pre-scope-split` at
`ef448067dd0b554127e6bf17605e596e7f2c0d60`, not incorporated into this candidate.

## Next-spec request after acceptance

Use the next available feature number at invocation, without precreating a spec directory:

```text
$speckit-specify Create Verified Mission Delegation from docs/roadmaps/verified-mission-os.md.
Verify the accepted Feature 002 preview handoff and carry forward D01-D04 from its transition record.
Reuse US8 mission envelopes, exact launch bindings, work DAGs, leases, structured returns and recovery.
Specify criterion-level evidence, Capability Passports, progress accountability, Mission Receipts,
and Mission Focus. Distinguish local verified results from future GitHub-confirmed PR readiness.
Do not add GitHub intake/delivery, automatic issue starts, merge or deployment in this feature.
```

GitHub Mission Intake remains a separate later feature. No repository review, owner acceptance,
installer distribution, credentialed provider run or paid runner provisioning is implied here.
