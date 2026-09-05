<p align="center">
  <img src="docs/assets/threadhelm-monogram.png" alt="ThreadHelm monogram" width="320" />
</p>

<h1 align="center">ThreadHelm</h1>

<p align="center"><strong>A calm command center for local AI agents.</strong></p>

ThreadHelm is a Windows-first, local-first desktop workspace for directing Codex CLI and Claude
Code without losing sight of what each process can access or do. Approve a folder, launch real
interactive sessions, supervise them side by side, and stop or recover them safely. It is operator
tooling, not a simulation: agent processes run locally, access boundaries are disclosed before
launch, recovery reports only what the application can prove, and the interface favors clear state
over characters, simulated activity, or game-like presentation.

## Status

**Pre-release. No approved download yet.**

The next distribution milestone is an unsigned Windows 11 x64 preview. That installer is **not yet
approved for distribution**: x64 client installed acceptance, uninstall cleanup, independent
review, and owner acceptance all remain open. ARM64 CI builds are validation artifacts, not
preview downloads. See the [approved preview scope](specs/002-agent-mailbox-routing/preview-release.md).

To build and run from source, see [docs/development.md](docs/development.md).

## What you can do today

**Sessions**

- **Approve a workspace** through the native folder picker. Identity comes from the opened
  directory handle (volume serial + file id), so aliases, junctions, and different spellings of the
  same folder are one workspace. Fixed local drives only.
- **Preflight and launch** Codex CLI or Claude Code from trusted install locations after a bounded
  version and authentication probe. The disclosure names the effective path, agent, and version
  alongside the access-boundary warning, and every session takes its own confirmation.
- **Supervise** at least four concurrent sessions, each in its own utility process and ConPTY,
  each inside a `KILL_ON_JOB_CLOSE` Job Object. Input reaches only the selected session, output
  stays attributed, and terminal control sequences cannot touch the clipboard, files, or the OS.
- **Interrupt, stop, force stop** with the exact target shown and bounded grace periods. A separate
  risk-disclosing confirmation gates `TerminateJobObject`, and closing the app with active sessions
  is blocked until you cancel or stop them all.
- **Recover honestly.** Unfinished sessions become _recovery required_ after a restart. Nothing is
  relaunched, no input is replayed, and raw terminal bytes, prompts, environment values, and
  credentials are never persisted.

**Missions**

- **Compose a mission** in a guided four-step composer (Outcome, Crew, Access & limits, Review),
  optionally starting from AI-suggested ideas for an approved repo. Every suggestion lands on an
  editable screen; nothing is applied or started without your confirmation.
- **Watch a mission** in Mission Focus: one approved direction, its crew, and its sessions in a
  single frame, with the same disclosures and controls as any other session.
- **Propose a crew** with workspace recon, an ordinary owner-confirmed session whose only return
  channel is a set of proposed agent roles. Each role is reviewed and accepted one at a time; there
  is no accept-all control.

## What it deliberately does not do

| Not available                         | Why                                                                                                |
| ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Automatic agent restart after a crash | Recovery reports state; it never invents continuity or replays your input.                         |
| Unproved autonomous provider starts   | Claude auto starts stay held when capability or policy proof is unavailable.                       |
| A signed installer                    | Releases are intentionally unsigned and verified by SHA-256 checksum.                              |
| ARM64 or non-Windows distribution     | Windows 11 x64 is the only acceptance target.                                                      |
| A 250 MiB idle-memory guarantee       | That target is deferred; the latest measurement is 380.324 MiB.                                    |
| ThreadHelm cloud sync or telemetry    | ThreadHelm adds no service of its own; the agent tools you launch still reach their own providers. |

## Design principles

- **Local by default.** ThreadHelm launches the agent tools already on your machine and keeps their
  terminal sessions there.
- **Explicit boundaries.** Every launch identifies the selected workspace, provider, version, and
  effective executable before the process starts.
- **Calm supervision.** Concurrent sessions stay visually separate, with input and controls scoped
  to the session you selected.
- **Honest recovery.** After a crash or restart, ThreadHelm never invents continuity, relaunches an
  agent, or replays input on your behalf.

## Documentation

| Document                                                                     | What it covers                                              |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------- |
| [docs/safety-model.md](docs/safety-model.md)                                 | Access boundaries, process containment, privacy filtering   |
| [docs/install.md](docs/install.md)                                           | Installation, publisher-trust limits, checksum verification |
| [docs/development.md](docs/development.md)                                   | Prerequisites, build, quality gates, packaging, repo layout |
| [docs/roadmaps/verified-mission-os.md](docs/roadmaps/verified-mission-os.md) | Approved product direction and feature sequence             |
| [`specs/`](specs/)                                                           | Feature specifications 001, 002, and the 003 draft          |
| [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md)            | Contribution rules and vulnerability reporting              |

## License

No open-source license has been selected. The repository is publicly visible, but no permission to
copy, modify, or redistribute its contents is granted unless a license is added later.
