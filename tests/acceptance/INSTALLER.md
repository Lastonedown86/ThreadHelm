# Disposable Windows installation acceptance

`Installed Windows acceptance` builds the actual NSIS Setup separately on GitHub-hosted x64 and
ARM64 runners, installs into that VM user's `%LOCALAPPDATA%\Programs\@threadhelmdesktop`, exercises the installed files,
and invokes that installation's byte-verified `Uninstall ThreadHelm.exe /S`. It never runs an installer on the
developer's account. The guard requires the explicit test opt-in, GitHub Actions, a `github-hosted`
Windows runner, matching architecture, bounded artifact paths, and no pre-existing ThreadHelm state.
Do not override those checks to run locally or on a self-hosted runner.

Push the reviewed workflow/test change to an ordinary PR to run it before merge. Path-filtered
`pull_request` works for the new workflow; `workflow_dispatch` becomes available once the workflow is
on the default branch. The workflow needs no signing/provider secrets and has read-only repository
permissions. Nothing is published as a GitHub Release. The current policy deliberately distributes
unsigned builds: `NotSigned` is accepted without asserting publisher trust; invalid signatures fail.

The report records the exact commit, runner architecture/Windows edition, Setup SHA-256, registration,
installed executable, shortcut presence, installed artifact acceptance result, and cleanup.
Forge retains application packaging, native copying, persona audits, ASAR integrity and fuses.
Pinned electron-builder consumes that directory through `prepackaged`, without rebuilding the app.
The maker rejects changed EXE/ASAR hashes, captures the generated uninstaller digest, and emits an
identity sidecar; installed acceptance verifies all three against the installed bytes. The helper
digest is build provenance, not Authenticode publisher trust. Optional signing credentials stay
inside the signing callback, outside builder's serialized configuration. Unsigned mode signs nothing.
The existing artifact suite checks actual installed fuses, architecture, private-persona absence,
startup/native loading, provider availability probes and single-instance behavior. No paid provider
session or live mission-provider proof is run.

The additional containment test loads the **installed** N-API binary in a bounded subprocess and starts
the **installed** native bridge beneath a dormant test helper using real Windows Job Objects. The
harness waits for that subprocess to close before uninstall: a loaded Windows DLL remains mapped even
after deleting a JavaScript require-cache entry. It verifies inheritance,
termination and kill-on-close. This native-artifact result is recorded separately from the next proof:
the actual installed `ThreadHelm.exe --threadhelm-proof-node <absolute node.exe> <helper arguments>`
launches a standalone diagnostic helper through the real Electron utility process/session host and
ConPTY. Main must assign and verify the dormant host before launch, verify the exact installed bridge
descendant in the Job, empty the scope on termination, and prove the host, root and exact bridge die
when the handle closes. The selected Node executable is the hosted workflow's installed runtime.

The diagnostic flag is explicit, rejects invalid/non-file Node paths, opens no coordinator storage or
provider settings, and does not grant normal provider eligibility. There is no environment switch to
enable it and no production fuse relaxation. Helper output and captured proof output are bounded;
process timeouts or missing proof markers fail acceptance. The report records a passing installed
Electron result only after these checks succeed; live provider/mission proof remains `NOT_RUN`.

Only the exact root-level `Uninstall ThreadHelm.exe` may differ from the target architecture,
after its digest matches the helper generated for this installer. Application executables,
native addons, DLLs and all nested payloads retain strict target-architecture checks.

Setup and uninstall are bounded. The uninstaller runs in `finally` even if an earlier acceptance
assertion fails. It is resolved under the exact newly created install root, never taken from arbitrary
registry command text. There is no manual recursive deletion of installation files, registry entries,
shortcuts or processes that could turn a broken uninstall into a pass. Remaining executable/package
payloads, uninstall registration, shortcuts, app/bridge processes or session credentials fail cleanup.
No retained NSIS installation entry is allowed, including a legacy `.dead` tombstone. Durable user data outside the installation tree is
not deleted by the harness or falsely claimed removed. Only curated reports are uploaded; raw app logs
and disposable bridge credential files are not uploaded. GitHub disposes of the VM after the job.
Failed nested acceptance cases retain bounded scenario/error codes and native relative paths without
raw assertion values. Uninstall diagnostics include at most 256 remaining relative paths, entry types
and file sizes, never file contents; reparse points are listed without following them.
The nested suite writes its report directly to the disposable runner report directory through
`THREADHELM_ARTIFACT_REPORT`; it must not add diagnostic files to the installation being tested.

Normal NSIS uninstall starts a relocated helper, so `uninstallLauncherExitCode` records only the
original process. The harness gives NSIS a fresh bounded TEMP/TMP directory under this run's report
root and includes every process beneath that directory in cleanup observation. At most 16 observed
helper identities (PID, parent, start time and readable image hash) are retained. A live temporary
helper fails cleanup; no helper is killed to obtain a pass. The test does not use `_?=` to disable
relocation. A helper may finish before the first observation; no child exit code is invented.
Staged TEMP files and the downloaded Setup are not installed application payload and are not
claimed deleted. They are not uploaded; the hosted VM is disposed after the job.

Earlier hosted runs exposed a vendor cleanup limitation: the previously shipped Squirrel
`2.0.1+eef37460ae` leaves `Update.exe` and the versioned `squirrel.exe` after uninstall. The current
acceptance still rejects those files. Its in-place uninstaller suppresses deletion failures
and has no supported post-exit cleanup switch. NSIS replaces only this installer stage; its normal
uninstaller relocates before removal. No custom deletion helper or harness cleanup script is added.
This is a fresh-install candidate, not a Squirrel upgrade migration. The test refuses any existing
Squirrel install root; do not silently remove or adopt one. NSIS is per-user, does not request
elevation, does not launch the app after setup and does not add an automatic updater.
See the [exact shipped uninstall implementation](https://github.com/Squirrel/Squirrel.Windows/blob/eef37460ae/src/Squirrel/UpdateManager.ApplyReleases.cs#L96-L143)
and [supported arguments](https://github.com/Squirrel/Squirrel.Windows/blob/eef37460ae/src/Update/StartupOption.cs#L36-L65).

The standard x64 hosted image may be Windows Server rather than Windows 11. Record its actual edition;
do not claim a supported Windows 11 x64 end-user workflow from that result alone. ARM64 runs on the
explicit Windows 11 ARM runner. Missing runner capacity, install failures, lifecycle-event hangs,
remaining cleanup, or absent installed Electron containment are failures, never skipped passes.

Sources used for the install contract:

- [electron-builder NSIS options](https://www.electron.build/nsis/)
- [NSIS uninstaller behavior](https://nsis.sourceforge.io/Docs/Chapter4.html#uninstall)
- [Squirrel FullUninstall and its .dead tombstone](https://github.com/Squirrel/Squirrel.Windows/blob/develop/src/Squirrel/UpdateManager.ApplyReleases.cs)
- [Squirrel Update command implementation](https://github.com/Squirrel/Squirrel.Windows/blob/develop/src/Update/Program.cs)
- [GitHub-hosted runner isolation and architecture labels](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
