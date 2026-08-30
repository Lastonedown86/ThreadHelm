import { describe, expect, it } from 'vitest';
import { ThreadHelmError } from '@threadhelm/contracts';
import {
  buildCmdShimInvocation,
  builtInAdapters,
  claudeCodeAdapter,
  codexAdapter,
  isWithinRange,
  parseVersion,
  resolveExecutable,
  type ProbeContext,
  type ProbeExecResult,
  type ProviderAdapter,
} from '@threadhelm/providers';

type Script = (executable: string, args: readonly string[]) => Partial<ProbeExecResult> | Error;

const ok = (stdout: string): Partial<ProbeExecResult> => ({ stdout, exitCode: 0 });

function makeContext(
  files: string[],
  script: Script,
  overrides: Partial<ProbeContext> = {},
): ProbeContext & { calls: string[][] } {
  const present = new Set(files.map((f) => f.toLowerCase()));
  const calls: string[][] = [];
  return {
    roots: {
      LOCALAPPDATA: 'C:\\Users\\Ana María\\AppData\\Local',
      APPDATA: 'C:\\Users\\Ana María\\AppData\\Roaming',
      PROGRAMFILES: 'C:\\Program Files',
      USERPROFILE: 'C:\\Users\\Ana María',
    },
    pathEntries: ['C:\\tools\\bin', 'relative\\dir'],
    excludedDirectories: [],
    timeoutMs: 1000,
    fs: { isFile: async (p) => present.has(p.toLowerCase()) },
    exec: async (executable, args) => {
      calls.push([executable, ...args]);
      const r = script(executable, args);
      if (r instanceof Error) throw r;
      return { stdout: '', stderr: '', exitCode: 0, timedOut: false, ...r };
    },
    calls,
    ...overrides,
  };
}

const cases: {
  adapter: ProviderAdapter;
  native: string;
  shim: string;
  version: string;
  auth: string[];
}[] = [
  {
    adapter: codexAdapter,
    native: 'C:\\Users\\Ana María\\AppData\\Local\\Programs\\codex\\codex.exe',
    shim: 'C:\\Users\\Ana María\\AppData\\Roaming\\npm\\codex.cmd',
    version: 'codex-cli 0.42.1',
    auth: ['login', 'status'],
  },
  {
    adapter: claudeCodeAdapter,
    native: 'C:\\Users\\Ana María\\AppData\\Local\\Programs\\claude\\claude.exe',
    shim: 'C:\\Users\\Ana María\\AppData\\Roaming\\npm\\claude.cmd',
    version: '1.0.120 (Claude Code)',
    auth: ['auth', 'status'],
  },
];

const SECRETS = ['alice@example.com', 'sk-secret123456789'];
const leaks = (r: object) => SECRETS.filter((s) => JSON.stringify(r).includes(s));

describe.each(cases)('$adapter.id adapter', ({ adapter, native, shim, version, auth }) => {
  it('reports missing when no trusted candidate exists', async () => {
    const ctx = makeContext([], () => ok(version));
    const r = await adapter.probe(ctx);
    expect(r).toMatchObject({
      availability: 'missing',
      authentication: 'unknown',
      reasonCode: 'EXECUTABLE_NOT_FOUND',
      resolvedExecutable: null,
    });
    expect(ctx.calls).toHaveLength(0);
  });

  it('is ready with a native executable in a path with spaces and Unicode', async () => {
    const ctx = makeContext([native, shim], () => ok(version));
    const r = await adapter.probe(ctx);
    expect(r).toMatchObject({
      availability: 'available',
      authentication: 'authenticated',
      resolvedExecutable: native,
      executableKind: 'native',
      version: parseVersion(version),
    });
    expect(ctx.calls[0]).toEqual([native, '--version']);
    expect(ctx.calls[1]).toEqual([native, ...auth]);
  });

  it('prefers a native exe over a cmd shim, uses the shim through cmd.exe otherwise', async () => {
    const ctx = makeContext([shim], () => ok(version));
    const r = await adapter.probe(ctx);
    expect(r.executableKind).toBe('cmd_shim');
    expect(ctx.calls[0]?.[0]).toBe('C:\\Windows\\System32\\cmd.exe');
    expect(ctx.calls[0]?.slice(1, 4)).toEqual(['/d', '/s', '/c']);
  });

  it('fails closed on an unsupported version and never probes auth', async () => {
    const ctx = makeContext([native], () => ok('99.0.0'));
    const r = await adapter.probe(ctx);
    expect(r).toMatchObject({
      availability: 'unsupported',
      authentication: 'unknown',
      reasonCode: 'VERSION_UNSUPPORTED',
      version: '99.0.0',
    });
    expect(r.safeSummary).toContain(adapter.testedVersionRange.min);
    expect(ctx.calls).toHaveLength(1);
  });

  it('reports a probe timeout as error/unknown', async () => {
    const ctx = makeContext([native], () => ({ timedOut: true, exitCode: null }));
    const r = await adapter.probe(ctx);
    expect(r).toMatchObject({
      availability: 'error',
      authentication: 'unknown',
      reasonCode: 'PROBE_TIMEOUT',
    });
  });

  it('reports unauthenticated only on a recognizable logged-out message', async () => {
    const ctx = makeContext([native], (_, args) =>
      args[0] === '--version'
        ? ok(version)
        : { stdout: 'Not logged in. Run login first.', exitCode: 1 },
    );
    expect(await adapter.probe(ctx)).toMatchObject({
      availability: 'unauthenticated',
      authentication: 'unauthenticated',
      reasonCode: 'NOT_AUTHENTICATED',
    });

    const vague = makeContext([native], (_, args) =>
      args[0] === '--version' ? ok(version) : { stdout: 'something odd', exitCode: 3 },
    );
    expect(await adapter.probe(vague)).toMatchObject({
      availability: 'error',
      authentication: 'unknown',
      reasonCode: 'AUTH_UNKNOWN',
    });
  });

  it('treats malformed version output as an error', async () => {
    const ctx = makeContext([native], () => ok('no numbers here'));
    expect(await adapter.probe(ctx)).toMatchObject({
      availability: 'error',
      reasonCode: 'VERSION_UNPARSEABLE',
      version: null,
    });
  });

  it('treats an immediate nonzero exit as an error', async () => {
    const ctx = makeContext([native], () => ({ stdout: '', exitCode: 127 }));
    expect(await adapter.probe(ctx)).toMatchObject({
      availability: 'error',
      reasonCode: 'PROBE_EXIT_NONZERO',
    });
  });

  it('reports cancellation', async () => {
    const controller = new AbortController();
    const ctx = makeContext(
      [native],
      () => {
        controller.abort();
        return ok(version);
      },
      { signal: controller.signal },
    );
    expect(await adapter.probe(ctx)).toMatchObject({
      availability: 'error',
      reasonCode: 'PROBE_CANCELLED',
    });
  });

  it('never leaks raw probe output into the result', async () => {
    const ctx = makeContext([native], (_, args) =>
      args[0] === '--version'
        ? ok(`${version}\naccount: alice@example.com token sk-secret123456789`)
        : { stdout: 'account: alice@example.com sk-secret123456789 not logged in', exitCode: 1 },
    );
    expect(leaks(await adapter.probe(ctx))).toEqual([]);
  });

  it('re-resolves the executable on every probe so a swap is visible', async () => {
    const files = [shim];
    const ctx = makeContext(files, () => ok(version));
    ctx.fs = { isFile: async (p) => files.map((f) => f.toLowerCase()).includes(p.toLowerCase()) };
    expect((await adapter.probe(ctx)).resolvedExecutable).toBe(shim);
    files.push(native);
    expect((await adapter.probe(ctx)).resolvedExecutable).toBe(native);
    expect((await resolveExecutable(adapter, ctx))?.path).toBe(native);
  });

  it('skips candidates inside excluded directories and relative PATH entries', async () => {
    const inWorkspace =
      'C:\\tools\\bin\\' + (adapter.id === 'codex-cli' ? 'codex.exe' : 'claude.exe');
    const ctx = makeContext([inWorkspace], () => ok(version), {
      excludedDirectories: ['c:\\tools'],
    });
    expect(await resolveExecutable(adapter, ctx)).toBeNull();
    const relative = makeContext(['relative\\dir\\codex.exe', 'relative\\dir\\claude.exe'], () =>
      ok(version),
    );
    expect(await resolveExecutable(adapter, relative)).toBeNull();
  });

  it('builds a launch descriptor with adapter-owned argv only and cwd from the process API', () => {
    const cwd = 'C:\\Users\\Ana María\\proyecto con espacios';
    const d = adapter.buildLaunch({
      sessionId: 's',
      canonicalWorkspacePath: cwd,
      resolvedExecutable: native,
      executableKind: 'native',
      terminal: { columns: 120, rows: 40 },
      version: '1.0.0',
      runtimeSelection: { model: null, effort: null },
    });
    expect(d).toEqual({
      executable: native,
      args: [],
      cwd,
      environmentPolicy: 'inherit-sanitized',
      terminal: { columns: 120, rows: 40 },
    });
    expect(JSON.stringify(d.args)).not.toContain(cwd);
    const viaShim = adapter.buildLaunch({
      sessionId: 's',
      canonicalWorkspacePath: cwd,
      resolvedExecutable: shim,
      executableKind: 'cmd_shim',
      terminal: { columns: 80, rows: 24 },
      version: '1.0.0',
      runtimeSelection: { model: null, effort: null },
    });
    expect(viaShim.executable).toBe('C:\\Windows\\System32\\cmd.exe');
    expect(viaShim.cwd).toBe(cwd);
  });

  it('maps an explicit model and effort to provider-owned per-process arguments', () => {
    const runtimeSelection = {
      model: adapter.id === 'codex-cli' ? 'gpt-5.6-luna' : 'fable',
      effort: 'low' as const,
    };
    const descriptor = adapter.buildLaunch({
      sessionId: 's',
      canonicalWorkspacePath: 'C:\\projects\\alpha',
      resolvedExecutable: native,
      executableKind: 'native',
      terminal: { columns: 100, rows: 30 },
      version: '1.0.0',
      runtimeSelection,
    });
    expect(descriptor.args).toEqual(
      adapter.id === 'codex-cli'
        ? ['--model', 'gpt-5.6-luna', '--config', 'model_reasoning_effort=low']
        : ['--model', 'fable', '--effort', 'low'],
    );
  });

  it('discloses an exact profile revision and only main-owned effective launch authority', () => {
    const context = {
      sessionId: 'session-a',
      canonicalWorkspacePath: 'C:\\projects\\alpha',
      resolvedExecutable: native,
      executableKind: 'native' as const,
      terminal: { columns: 100, rows: 30 },
      version: '1.0.0',
      runtimeSelection: {
        model: adapter.id === 'codex-cli' ? 'gpt-5.6-sol' : 'claude-sonnet-5',
        effort: 'medium' as const,
      },
      profileBinding: {
        profileId: '11111111-1111-4111-8111-111111111111',
        profileRevisionId: '22222222-2222-4222-8222-222222222222',
        workspaceId: '33333333-3333-4333-8333-333333333333',
        requestedIsolation: true,
        effectiveIsolation: true,
        requestedTokenCap: 2_000_000,
        effectiveTokenBudget: 250_000,
        effectiveResourceBudget: { maxElapsedMs: 600_000, maxConcurrentProcesses: 1 },
        toolRegistry: ['coordination.list-pending', 'coordination.reply'],
      },
    };
    const disclosure = adapter.buildLaunchDisclosure(context);
    expect(disclosure).toEqual({
      providerId: adapter.id,
      profileId: context.profileBinding.profileId,
      profileRevisionId: context.profileBinding.profileRevisionId,
      workspaceId: context.profileBinding.workspaceId,
      canonicalWorkspacePath: context.canonicalWorkspacePath,
      model: context.runtimeSelection.model,
      effort: 'medium',
      requestedIsolation: true,
      effectiveIsolation: true,
      requestedTokenCap: 2_000_000,
      effectiveTokenBudget: 250_000,
      effectiveResourceBudget: { maxElapsedMs: 600_000, maxConcurrentProcesses: 1 },
      toolRegistry: ['coordination.list-pending', 'coordination.reply'],
      configurationScope: 'process_only',
    });
    const descriptor = adapter.buildLaunch(context);
    expect(descriptor.args.join(' ')).not.toContain(context.profileBinding.profileId);
    expect(descriptor.args.join(' ')).not.toContain(context.profileBinding.profileRevisionId);
    expect(descriptor.args).not.toContain('--settings');
  });

  it('fails closed when a profile request would exceed effective launch authority', () => {
    expect(() =>
      adapter.buildLaunchDisclosure({
        sessionId: 'session-a',
        canonicalWorkspacePath: 'C:\\projects\\alpha',
        resolvedExecutable: native,
        executableKind: 'native',
        terminal: { columns: 100, rows: 30 },
        version: '1.0.0',
        runtimeSelection: { model: null, effort: null },
        profileBinding: {
          profileId: 'profile-a',
          profileRevisionId: 'revision-a',
          workspaceId: 'workspace-a',
          requestedIsolation: true,
          effectiveIsolation: false,
          requestedTokenCap: 100_000,
          effectiveTokenBudget: 200_000,
          effectiveResourceBudget: { maxElapsedMs: 600_000, maxConcurrentProcesses: 1 },
          toolRegistry: [],
        },
      }),
    ).toThrowError('Profile launch policy does not safely narrow.');
  });

  it('owns a bounded clean stop', () => {
    const stop = adapter.buildCleanStop({ sessionId: 's' });
    expect(stop.writes).toHaveLength(1);
    expect(stop.graceMs).toBeGreaterThan(0);
  });
});

describe('provider independence', () => {
  it('one adapter throwing does not affect the other', async () => {
    const boom = makeContext([cases[0]!.native], () => new Error('exec exploded'));
    const fine = makeContext([cases[1]!.native], () => ok(cases[1]!.version));
    const [a, b] = await Promise.all([codexAdapter.probe(boom), claudeCodeAdapter.probe(fine)]);
    expect(a).toMatchObject({ availability: 'error', reasonCode: 'PROBE_FAILED' });
    expect(b.availability).toBe('available');
    expect(builtInAdapters.map((x) => x.id)).toEqual(['codex-cli', 'claude-code']);
  });
});

describe('buildCmdShimInvocation', () => {
  it('quotes a shim path with spaces and Unicode and fixed args', () => {
    const r = buildCmdShimInvocation('C:\\Users\\Ana María\\AppData\\Roaming\\npm\\codex.cmd', [
      '--version',
    ]);
    expect(r.executable).toBe('C:\\Windows\\System32\\cmd.exe');
    expect(r.args).toEqual([
      '/d',
      '/s',
      '/c',
      '""C:\\Users\\Ana María\\AppData\\Roaming\\npm\\codex.cmd" --version"',
    ]);
  });

  it.each(['a&b', 'a|b', 'a"b', '%PATH%', 'x!y', 'x^y', 'a<b', 'a>b', 'a\nb'])(
    'rejects token %j',
    (token) => {
      expect(() => buildCmdShimInvocation('C:\\x\\y.cmd', [token])).toThrowError(ThreadHelmError);
    },
  );

  it('rejects non-absolute or non-.cmd shims', () => {
    expect(() => buildCmdShimInvocation('codex.cmd', [])).toThrow();
    expect(() => buildCmdShimInvocation('C:\\x\\codex.ps1', [])).toThrow();
  });
});

describe('versions', () => {
  it('parses and ranges', () => {
    expect(parseVersion('1.0.120 (Claude Code)')).toBe('1.0.120');
    expect(parseVersion('nope')).toBeNull();
    expect(isWithinRange('1.9.9', { min: '1.0.0', maxExclusive: '2.0.0' })).toBe(true);
    expect(isWithinRange('2.0.0', { min: '1.0.0', maxExclusive: '2.0.0' })).toBe(false);
    expect(isWithinRange('0.9.0', { min: '1.0.0', maxExclusive: '2.0.0' })).toBe(false);
  });
});
