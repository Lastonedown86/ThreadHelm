/**
 * Architecture proof (T014), runnable headlessly against a dev or PACKAGED
 * build with `--threadhelm-proof`. Uses the real host protocol: bootstrap →
 * ready → assign → verify → launch (fixture agent via ConPTY) → descendants
 * contained → terminate → scope empty → handle closure kills survivors.
 */

import {
  app,
  MessageChannelMain,
  utilityProcess,
  type MessagePortMain,
  type UtilityProcess,
} from 'electron';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import {
  PROTOCOL_VERSION,
  type HostToMainMessage,
  type LaunchDescriptor,
} from '@threadhelm/contracts';
import * as native from '@threadhelm/windows-supervisor';
import { isProofDescendant } from './proof-descendant.js';

export interface ProofResult {
  passed: boolean;
  steps: Record<string, unknown>;
  failure?: string;
}

const TIMEOUT_MS = 15_000;
const MAX_DIAGNOSTIC_BYTES = 64 * 1024;

function waitFor<T extends HostToMainMessage['type']>(host: UtilityProcess, type: T) {
  return new Promise<Extract<HostToMainMessage, { type: T }>>((resolve, reject) => {
    const timer = setTimeout(() => {
      host.removeListener('message', onMessage);
      reject(new Error(`TIMEOUT_${type}`));
    }, TIMEOUT_MS);
    function onMessage(data: HostToMainMessage) {
      if (data?.type === 'host.failure') {
        clearTimeout(timer);
        host.removeListener('message', onMessage);
        reject(new Error(data.code));
        return;
      }
      if (data?.type !== type) return;
      clearTimeout(timer);
      host.removeListener('message', onMessage);
      resolve(data as Extract<HostToMainMessage, { type: T }>);
    }
    host.on('message', onMessage);
  });
}

function waitForExit(pid: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const tick = () => {
      try {
        process.kill(pid, 0);
      } catch {
        resolve(true);
        return;
      }
      if (Date.now() > deadline) resolve(false);
      else setTimeout(tick, 100);
    };
    tick();
  });
}

async function withScope(
  hostEntry: string,
  descriptor: LaunchDescriptor,
  steps: Record<string, unknown>,
): Promise<{
  token: number;
  host: UtilityProcess;
  hostPid: number;
  rootPid: number;
  outputPort: MessagePortMain;
  output: () => string;
}> {
  const sessionId = randomUUID();
  const token = native.createKillOnCloseJob();
  let createdHost: UtilityProcess | undefined;
  let createdPort: MessagePortMain | undefined;
  try {
    const host = utilityProcess.fork(hostEntry, [], { stdio: 'ignore' });
    createdHost = host;
    const ready = waitFor(host, 'host.ready');
    const bootstrapSecret = randomBytes(24).toString('base64url');
    host.postMessage({
      type: 'host.bootstrap',
      sessionId,
      protocolVersion: PROTOCOL_VERSION,
      bootstrapSecret,
    });
    const { hostPid } = await ready;
    steps.dormantJobEmpty = native.inspectJob(token).activeProcessCount === 0;
    if (!steps.dormantJobEmpty) throw new Error('DORMANT_SCOPE_NOT_EMPTY');
    native.assignProcess(token, hostPid);
    steps.hostVerifiedInJob = native.verifyProcessInJob(token, hostPid);
    steps.jobHoldsOnlyHost = native.inspectJob(token).activeProcessCount === 1;
    if (!steps.hostVerifiedInJob || !steps.jobHoldsOnlyHost)
      throw new Error('CONTAINMENT_NOT_PROVEN');

    const channel = new MessageChannelMain();
    createdPort = channel.port2;
    let output = '';
    let outputBytes = 0;
    channel.port2.start();
    channel.port2.on('message', (event) => {
      const frame = event.data as { kind?: unknown; bytes?: unknown };
      if (frame.kind !== 'output') return;
      const bytes = frame.bytes;
      const buffer = ArrayBuffer.isView(bytes)
        ? Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
        : bytes instanceof ArrayBuffer
          ? Buffer.from(bytes)
          : undefined;
      if (!buffer || outputBytes >= MAX_DIAGNOSTIC_BYTES) return;
      const prefix = buffer.subarray(0, MAX_DIAGNOSTIC_BYTES - outputBytes);
      outputBytes += prefix.byteLength;
      output += prefix.toString('utf8');
    });
    const launched = waitFor(host, 'host.launched');
    host.postMessage(
      {
        type: 'host.launch',
        sessionId,
        protocolVersion: PROTOCOL_VERSION,
        bootstrapSecret,
        descriptor,
      },
      [channel.port1],
    );
    const { rootPid } = await launched;
    steps.rootVerifiedInJob = native.verifyProcessInJob(token, rootPid);
    if (!steps.rootVerifiedInJob) throw new Error('ROOT_CONTAINMENT_NOT_PROVEN');
    return { token, host, hostPid, rootPid, outputPort: channel.port2, output: () => output };
  } catch (error) {
    try {
      createdPort?.close();
    } catch {
      /* preserve the proof failure */
    }
    try {
      native.closeJob(token);
    } catch {
      /* fail result still cannot pass */
    }
    try {
      createdHost?.kill();
    } catch {
      /* host may already have exited */
    }
    throw error;
  }
}

async function waitForDescendant(
  scope: Awaited<ReturnType<typeof withScope>>,
  fixtureArgs: string[],
): Promise<number | null> {
  const flag = fixtureArgs.indexOf('--descendant-pid-file');
  const pidFile = flag >= 0 ? fixtureArgs[flag + 1] : undefined;
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const match = /\b(?:CHILD|BRIDGE)_PID:(\d+)/.exec(scope.output());
    let pid = match ? Number(match[1]) : 0;
    if (!pid && pidFile) {
      try {
        if (statSync(pidFile).size <= 32) pid = Number(readFileSync(pidFile, 'utf8').trim());
      } catch {
        /* contained child has not published its PID */
      }
    }
    // A stale file from the previous scope cannot establish containment in this scope.
    try {
      if (
        isProofDescendant(pid, scope, (candidate) =>
          native.verifyProcessInJob(scope.token, candidate),
        )
      )
        return pid;
    } catch {
      /* a previous scope's PID may already be gone */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return null;
}

export async function runProof(
  hostEntry: string,
  fixtureArgs: string[],
  fixtureExecutable = process.execPath,
): Promise<ProofResult> {
  const steps: Record<string, unknown> = {};
  const tokens: number[] = [];
  const ports: MessagePortMain[] = [];
  const descriptor: LaunchDescriptor = {
    executable: fixtureExecutable,
    args: fixtureArgs,
    cwd: app.getPath('temp'),
    environmentPolicy: 'inherit-sanitized',
    terminal: { columns: 100, rows: 30 },
  };
  try {
    // Scope A: descendants (fixture spawns a grandchild) + TerminateJobObject
    const a = await withScope(hostEntry, descriptor, steps);
    tokens.push(a.token);
    ports.push(a.outputPort);
    const deadline = Date.now() + TIMEOUT_MS;
    let snapshot = native.inspectJob(a.token);
    while (snapshot.activeProcessCount < 3 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      snapshot = native.inspectJob(a.token);
    }
    steps.processCountWithDescendants = snapshot.activeProcessCount;
    steps.descendantsContained = snapshot.activeProcessCount >= 3; // host + root + grandchild
    const descendantPid = await waitForDescendant(a, fixtureArgs);
    steps.descendantPid = descendantPid;
    steps.descendantVerifiedInJob =
      descendantPid !== null && native.verifyProcessInJob(a.token, descendantPid);
    const terminated = native.terminateJob(a.token, 1);
    steps.scopeEmptyAfterTerminate = terminated.activeProcessCount === 0;
    a.outputPort.close();
    native.closeJob(a.token);
    tokens.pop();

    // Scope B: closing the handle alone (coordinator death) kills the tree
    const b = await withScope(hostEntry, descriptor, steps);
    tokens.push(b.token);
    ports.push(b.outputPort);
    const closeDescendant = await waitForDescendant(b, fixtureArgs);
    steps.closeDescendantVerifiedInJob = closeDescendant !== null;
    steps.closeDescendantPid = closeDescendant;
    b.outputPort.close();
    native.closeJob(b.token);
    tokens.pop();
    steps.rootDiesOnHandleClose = await waitForExit(b.rootPid, TIMEOUT_MS);
    steps.hostDiesOnHandleClose = await waitForExit(b.hostPid, TIMEOUT_MS);
    steps.descendantDiesOnHandleClose =
      closeDescendant !== null && (await waitForExit(closeDescendant, TIMEOUT_MS));

    const passed =
      steps.dormantJobEmpty === true &&
      steps.hostVerifiedInJob === true &&
      steps.jobHoldsOnlyHost === true &&
      steps.rootVerifiedInJob === true &&
      steps.descendantsContained === true &&
      steps.descendantVerifiedInJob === true &&
      steps.scopeEmptyAfterTerminate === true &&
      steps.rootDiesOnHandleClose === true &&
      steps.hostDiesOnHandleClose === true &&
      steps.closeDescendantVerifiedInJob === true &&
      steps.descendantDiesOnHandleClose === true;
    return { passed, steps };
  } catch (error) {
    return { passed: false, steps, failure: error instanceof Error ? error.message : 'UNKNOWN' };
  } finally {
    for (const port of ports) {
      try {
        port.close();
      } catch {
        /* already closed */
      }
    }
    for (const token of tokens) {
      try {
        native.closeJob(token);
      } catch {
        /* already closed */
      }
    }
  }
}
