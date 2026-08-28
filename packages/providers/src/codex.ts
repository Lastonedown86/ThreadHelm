/** Codex CLI adapter (T040). Interactive TUI in the approved cwd. */

import type { CleanStopAction, LaunchDescriptor } from '@threadhelm/contracts';
import {
  interactiveLaunch,
  runProbe,
  type LaunchContext,
  type ProbeContext,
  type ProviderAdapter,
} from './adapter.js';

const CODEX_ARGS: readonly string[] = [];

export const codexAdapter: ProviderAdapter = {
  id: 'codex-cli',
  displayName: 'Codex CLI',
  testedVersionRange: { min: '0.20.0', maxExclusive: '2.0.0' },
  capabilities: {
    interactivePty: true,
    structuredActivity: false,
    cleanStopStrategy: 'slash_exit',
  },
  executableCandidates: [
    { relativeTo: 'LOCALAPPDATA', subpath: 'Programs\\codex\\codex.exe', kind: 'native' },
    { relativeTo: 'USERPROFILE', subpath: '.codex\\bin\\codex.exe', kind: 'native' },
    { relativeTo: 'PATH', subpath: 'codex.exe', kind: 'native' },
    { relativeTo: 'APPDATA', subpath: 'npm\\codex.cmd', kind: 'cmd_shim' },
    { relativeTo: 'PATH', subpath: 'codex.cmd', kind: 'cmd_shim' },
  ],
  probe(ctx: ProbeContext) {
    return runProbe(this, ctx, {
      versionArgs: ['--version'],
      authArgs: ['login', 'status'],
      unauthenticatedPattern: /not\s+logged\s+in|logged\s+out/i,
    });
  },
  buildLaunch(ctx: LaunchContext): LaunchDescriptor {
    return interactiveLaunch(ctx, CODEX_ARGS);
  },
  buildCleanStop(): CleanStopAction {
    return { writes: ['/quit\r'], graceMs: 10_000 };
  },
};
