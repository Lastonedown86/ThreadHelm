/** Claude Code adapter (T041). Interactive TUI in the approved cwd. */

import type { CleanStopAction, LaunchDescriptor } from '@threadhelm/contracts';
import {
  interactiveLaunch,
  runProbe,
  type LaunchContext,
  type ProbeContext,
  type ProviderAdapter,
} from './adapter.js';

const CLAUDE_ARGS: readonly string[] = [];

export const claudeCodeAdapter: ProviderAdapter = {
  id: 'claude-code',
  displayName: 'Claude Code',
  testedVersionRange: { min: '1.0.0', maxExclusive: '3.0.0' },
  capabilities: {
    interactivePty: true,
    structuredActivity: false,
    cleanStopStrategy: 'slash_exit',
  },
  executableCandidates: [
    { relativeTo: 'LOCALAPPDATA', subpath: 'Programs\\claude\\claude.exe', kind: 'native' },
    { relativeTo: 'USERPROFILE', subpath: '.local\\bin\\claude.exe', kind: 'native' },
    { relativeTo: 'PATH', subpath: 'claude.exe', kind: 'native' },
    { relativeTo: 'APPDATA', subpath: 'npm\\claude.cmd', kind: 'cmd_shim' },
    { relativeTo: 'PATH', subpath: 'claude.cmd', kind: 'cmd_shim' },
  ],
  probe(ctx: ProbeContext) {
    return runProbe(this, ctx, {
      versionArgs: ['--version'],
      authArgs: ['auth', 'status'],
      unauthenticatedPattern: /not\s+logged\s+in|logged\s+out/i,
    });
  },
  buildLaunch(ctx: LaunchContext): LaunchDescriptor {
    return interactiveLaunch(ctx, CLAUDE_ARGS);
  },
  buildCleanStop(): CleanStopAction {
    return { writes: ['/exit\r'], graceMs: 10_000 };
  },
};
