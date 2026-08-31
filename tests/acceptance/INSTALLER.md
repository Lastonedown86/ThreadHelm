# Disposable Windows installation acceptance

`Installed Windows acceptance` builds the actual Squirrel Setup separately on GitHub-hosted x64 and
ARM64 runners, installs into that VM user's `%LOCALAPPDATA%\ThreadHelm`, exercises the installed files,
and invokes that installation's `Update.exe --uninstall --silent`. It never runs an installer on the
developer's account. The guard requires the explicit test opt-in, GitHub Actions, a `github-hosted`
Windows runner, matching architecture, bounded artifact paths, and no pre-existing ThreadHelm state.
Do not override those checks to run locally or on a self-hosted runner.

Push the reviewed workflow/test change to an ordinary PR to run it before merge. Path-filtered
`pull_request` works for the new workflow; `workflow_dispatch` becomes available once the workflow is
on the default branch. The workflow needs no signing/provider secrets and has read-only repository
permissions. Nothing is published as a GitHub Release. The current policy deliberately distributes
unsigned builds: `NotSigned` is accepted without asserting publisher trust; invalid signatures fail.

The report records the exact commit, runner architecture/Windows edition, Setup SHA-256, registration,
versioned installed executable, shortcut presence, installed artifact acceptance result, and cleanup.
The existing artifact suite checks actual installed fuses, architecture, private-persona absence,
startup/native loading, provider availability probes and single-instance behavior. No paid provider
session or live mission-provider proof is run.

The additional containment test loads the **installed** N-API binary and starts the **installed**
native bridge beneath a dormant test helper using real Windows Job Objects. It verifies inheritance,
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

Setup and uninstall are bounded. The uninstaller runs in `finally` even if an earlier acceptance
assertion fails. It is resolved under the exact newly created install root, never taken from arbitrary
registry command text. There is no manual recursive deletion of installation files, registry entries,
shortcuts or processes that could turn a broken uninstall into a pass. Remaining executable/package
payloads, uninstall registration, shortcuts, app/bridge processes or session credentials fail cleanup.
Squirrel's documented `.dead` tombstone is allowed. Durable user data outside the installation tree is
not deleted by the harness or falsely claimed removed. Only curated reports are uploaded; raw app logs
and disposable bridge credential files are not uploaded. GitHub disposes of the VM after the job.

The standard x64 hosted image may be Windows Server rather than Windows 11. Record its actual edition;
do not claim a supported Windows 11 x64 end-user workflow from that result alone. ARM64 runs on the
explicit Windows 11 ARM runner. Missing runner capacity, install failures, lifecycle-event hangs,
remaining cleanup, or absent installed Electron containment are failures, never skipped passes.

Sources used for the install contract:

- [Electron Forge Squirrel maker](https://www.electronforge.io/config/makers/squirrel.windows)
- [electron-winstaller startup events](https://github.com/electron/windows-installer#handling-squirrel-events)
- [Squirrel FullUninstall and its .dead tombstone](https://github.com/Squirrel/Squirrel.Windows/blob/develop/src/Squirrel/UpdateManager.ApplyReleases.cs)
- [Squirrel Update command implementation](https://github.com/Squirrel/Squirrel.Windows/blob/develop/src/Update/Program.cs)
- [GitHub-hosted runner isolation and architecture labels](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
