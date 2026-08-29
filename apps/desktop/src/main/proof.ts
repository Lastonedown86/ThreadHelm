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
import { readFileSync } from 'node:fs';
import {
  PROTOCOL_VERSION,
  type HostToMainMessage,
  type LaunchDescriptor,
} from '@threadhelm/contracts';
import * as native from '@threadhelm/windows-supervisor';

export interface ProofResult {
  passed: boolean;
  steps: Record<string, unknown>;
  failure?: string;
}

const TIMEOUT_MS = 15_000;

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
  const host = utilityProcess.fork(hostEntry, [], { stdio: 'ignore' });
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
  native.assignProcess(token, hostPid);
  steps.hostVerifiedInJob = native.verifyProcessInJob(token, hostPid);
  steps.jobHoldsOnlyHost = native.inspectJob(token).activeProcessCount === 1;
  if (!steps.hostVerifiedInJob || !steps.jobHoldsOnlyHost)
    throw new Error('CONTAINMENT_NOT_PROVEN');

  const channel = new MessageChannelMain();
  let output = '';
  channel.port2.start();
  channel.port2.on('message', (event) => {
    const frame = event.data as { kind?: unknown; bytes?: unknown };
    if (frame.kind !== 'output') return;
    const bytes = frame.bytes;
    if (ArrayBuffer.isView(bytes)) {
      output += Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('utf8');
    } else if (bytes instanceof ArrayBuffer) {
      output += Buffer.from(bytes).toString('utf8');
    }
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
  return { token, host, hostPid, rootPid, outputPort: channel.port2, output: () => output };
}

export async function runProof(hostEntry: string, fixtureArgs: string[]): Promise<ProofResult> {
  const steps: Record<string, unknown> = {};
  const tokens: number[] = [];
  const descriptor: LaunchDescriptor = {
    executable: process.execPath,
    args: fixtureArgs,
    cwd: app.getPath('temp'),
    environmentPolicy: 'inherit-sanitized',
    terminal: { columns: 100, rows: 30 },
  };
  try {
    // Scope A: descendants (fixture spawns a grandchild) + TerminateJobObject
    const a = await withScope(hostEntry, descriptor, steps);
    tokens.push(a.token);
    const deadline = Date.now() + TIMEOUT_MS;
    let snapshot = native.inspectJob(a.token);
    while (snapshot.activeProcessCount < 3 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      snapshot = native.inspectJob(a.token);
    }
    steps.processCountWithDescendants = snapshot.activeProcessCount;
    steps.descendantsContained = snapshot.activeProcessCount >= 3; // host + root + grandchild
    const pidFileFlag = fixtureArgs.indexOf('--descendant-pid-file');
    const descendantPidFile = pidFileFlag >= 0 ? fixtureArgs[pidFileFlag + 1] : undefined;
    let descendantPid: number | null = null;
    while (descendantPid === null && Date.now() < deadline) {
      const match = /\b(?:CHILD|BRIDGE)_PID:(\d+)/.exec(a.output());
      descendantPid = match ? Number(match[1]) : null;
      if (descendantPid === null && descendantPidFile) {
        try {
          const value = Number(readFileSync(descendantPidFile, 'utf8').trim());
          descendantPid = Number.isSafeInteger(value) && value > 0 ? value : null;
        } catch {
          // The contained provider has not published its child pid yet.
        }
      }
      if (descendantPid === null) await new Promise((resolve) => setTimeout(resolve, 100));
    }
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
    b.outputPort.close();
    native.closeJob(b.token);
    tokens.pop();
    steps.rootDiesOnHandleClose = await waitForExit(b.rootPid, TIMEOUT_MS);
    steps.hostDiesOnHandleClose = await waitForExit(b.hostPid, TIMEOUT_MS);

    const passed =
      steps.dormantJobEmpty === true &&
      steps.hostVerifiedInJob === true &&
      steps.jobHoldsOnlyHost === true &&
      steps.rootVerifiedInJob === true &&
      steps.descendantsContained === true &&
      steps.descendantVerifiedInJob === true &&
      steps.scopeEmptyAfterTerminate === true &&
      steps.rootDiesOnHandleClose === true &&
      steps.hostDiesOnHandleClose === true;
    return { passed, steps };
  } catch (error) {
    return { passed: false, steps, failure: error instanceof Error ? error.message : 'UNKNOWN' };
  } finally {
    for (const token of tokens) {
      try {
        native.closeJob(token);
      } catch {
        /* already closed */
      }
    }
  }
}
