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
| Candidate source commit and installer SHA-256 | Local installed runtime f53441ee58b9326cfb5d615d34adeb7da80b0e22; x64 Setup 06c0284d2fa39aa0bea196c1f7b23c2f911b519c872b541226e5b74971c567ef. Later T168 changes tests/documentation only. |
| P01: Windows 11 x64 installed/manual acceptance | Updated on the owner's machine after a verified backup. Exact installed identity, native-template UI and containment diagnostic passed on Windows 11 Home x64. Earlier single-instance evidence belongs to 88d1b41; broader manual workflow acceptance remains pending. |
| P02: actual uninstall with no executable residue | Earlier 88d1b41 passed in run 33364588605 without manual deletion. Current artifact does not inherit that result; fresh hosted artifact acceptance pending. |
| P03: independent safety review and host scope reconciliation | Worker-bound/recovery fixes passed independent review. Owner exception remains pending. |
| P04: x64 candidate controls and applicable CI | f53441e static installed controls and containment diagnostic passed; Setup/installed identity independently verified. Fresh hosted CI and retained four-session supported-client resource proof remain pending. |
| P05: owner acceptance of exact candidate and limitations | Pending P01-P04 |
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
checkout: `3d6fe256ee455dbdf7af1a1568b4df7104fd26ae`. The x64 Setup digest is above; diagnostic ARM64
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
