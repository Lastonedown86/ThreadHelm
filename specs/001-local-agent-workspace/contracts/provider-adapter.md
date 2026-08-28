# Contract: Provider Adapter

The provider contract isolates Codex CLI and Claude Code from orchestration policy. Adapters are
built into the signed application; the MVP does not load plugins or user-authored `.agent` files.

## Interface

```ts
interface ProviderAdapter {
  readonly id: 'codex-cli' | 'claude-code';
  readonly displayName: string;

  probe(context: ProbeContext): Promise<ReadinessResult>;
  buildLaunch(context: LaunchContext): LaunchDescriptor;
  buildCleanStop(context: StopContext): CleanStopAction;
  parseStructuredActivity?(event: Uint8Array): ActivityEvidence | null;
}
```

### `ProbeContext`

- Contains trusted application/install search roots and a strict timeout/cancellation signal.
- Does not contain renderer-supplied executable paths or arbitrary arguments.
- Probe execution uses the resolved absolute native executable whenever available.

### `ReadinessResult`

- Normalized executable path, parsed version, availability enum, authentication enum, stable reason
  code, and allowlisted safe summary.
- Raw stdout/stderr is bounded, parsed in memory, and discarded immediately. It may contain account
  or organization metadata and must never be logged, persisted, or forwarded to the renderer.
- Timeout, malformed output, or uncertain authentication produces `unknown`/`error`, never a
  favorable inferred state.

### `LaunchContext`

- Session ID, revalidated canonical workspace path, trusted resolved executable, safe terminal
  dimensions, controlled environment policy, and adapter version facts.
- The adapter returns an executable plus an argument array. It never returns an untrusted shell
  string and never incorporates a renderer-supplied prompt, flag, path, or environment value.
- The process working directory is supplied through the process API, not embedded in command text.

### `LaunchDescriptor`

```ts
type LaunchDescriptor = {
  executable: string;
  args: readonly string[];
  cwd: string;
  environmentPolicy: 'inherit-sanitized';
  terminal: { columns: number; rows: number };
};
```

If a supported installation provides only a `.cmd` launcher, the adapter may use the absolute
system `cmd.exe` with `/d /s /c` only through a separately tested quoting builder. The shell command
may contain only adapter-owned fixed tokens and the trusted resolved launcher path; user prompts,
flags, workspace text, and environment values are prohibited.

## Required behavior

1. Resolver excludes the selected workspace/current directory and other user-writable search
   locations not explicitly trusted by policy.
2. Probe and launch re-resolve the executable and compare identity/version so the preview cannot
   authorize a changed target.
3. Unsupported versions fail closed with an actionable update/tested-range explanation.
4. Authentication probes report only normalized readiness; adapters never read or store provider
   credential files.
5. A provider error changes only its readiness/session; it cannot mutate another adapter or session.
6. Clean stop is provider-specific and bounded. It cannot bypass Job Object force-stop authority.
7. Activity remains `unknown` unless a documented, version-compatible structured provider signal is
   available. Terminal text and quiet timers are not parsed as status.

## MVP adapters

- `codex-cli`: trusted native executable preferred; interactive launch in the approved cwd.
- `claude-code`: trusted native executable preferred; interactive launch in the approved cwd.

Future Codex app-server events or Claude hooks may implement structured activity behind this same
contract, but they are not MVP dependencies and may not be simulated from terminal output.

## Contract tests

Each adapter must pass missing binary, unsupported version, probe timeout, unauthenticated,
malformed output, executable swap, path with spaces/Unicode, safe argv construction, raw-output
redaction, cancellation, immediate exit, and independent-provider failure cases.
