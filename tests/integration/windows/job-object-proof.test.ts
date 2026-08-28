/**
 * T014 — architecture proof gate.
 *
 * Runs the built desktop app headlessly with `--threadhelm-proof` and checks
 * every containment step the plan requires: a dormant utility process is
 * assigned to and verified inside a KILL_ON_JOB_CLOSE Job Object BEFORE it
 * launches a descendant; the descendant and its grandchild are contained;
 * TerminateJobObject empties the scope; and closing the handle alone kills
 * the tree. Failure here blocks the Electron plan (see plan.md gate 1).
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { FAKE_AGENT_PATH } from '@threadhelm/test-fixtures';
import { describe, expect, it } from 'vitest';
import { electronExe as electron } from '../../e2e/helpers/app.js';

const root = resolve(__dirname, '../../..');
const desktop = resolve(root, 'apps/desktop');
const entry = resolve(desktop, 'out/main/index.cjs');

interface ProofResult {
  passed: boolean;
  steps: Record<string, unknown>;
  failure?: string;
}

export function runProof(
  extraArgs: string[] = [],
): Promise<{ result: ProofResult | null; stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolvePromise) => {
    const child = spawn(
      electron,
      [entry, '--threadhelm-proof', FAKE_AGENT_PATH, '--mode', 'spawn-children', ...extraArgs],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        env: { ...process.env, ELECTRON_ENABLE_LOGGING: '0' },
      },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString('utf8')));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString('utf8')));
    child.on('exit', (code) => {
      const line = stdout.split(/\r?\n/).find((l) => l.startsWith('THREADHELM_PROOF '));
      const result = line
        ? (JSON.parse(line.slice('THREADHELM_PROOF '.length)) as ProofResult)
        : null;
      resolvePromise({ result, stdout, stderr, code });
    });
  });
}

describe('architecture proof gate (T014)', () => {
  it('has a built desktop app to prove against', () => {
    expect(existsSync(electron)).toBe(true);
    expect(existsSync(entry)).toBe(true);
  });

  it('assigns and verifies the dormant host in a kill-on-close job before any descendant exists', async () => {
    const { result, stderr, code } = await runProof();
    expect(
      result,
      `no proof output; exit ${code}; stderr: ${stderr.slice(0, 2000)}`,
    ).not.toBeNull();
    const steps = result!.steps;
    expect(steps.dormantJobEmpty, 'job must be empty while the host is dormant').toBe(true);
    expect(steps.hostVerifiedInJob, 'host pid must be verified inside the job').toBe(true);
    expect(steps.jobHoldsOnlyHost, 'nothing may be launched before containment').toBe(true);
    expect(steps.rootVerifiedInJob, 'provider root must inherit job membership').toBe(true);
    expect(steps.descendantsContained, 'grandchildren must be inside the same job').toBe(true);
    expect(steps.scopeEmptyAfterTerminate, 'TerminateJobObject must empty the scope').toBe(true);
    expect(steps.rootDiesOnHandleClose, 'closing the handle must kill the root').toBe(true);
    expect(steps.hostDiesOnHandleClose, 'closing the handle must kill the host').toBe(true);
    expect(result!.passed, result!.failure).toBe(true);
    expect(code).toBe(0);
  }, 120_000);
});
