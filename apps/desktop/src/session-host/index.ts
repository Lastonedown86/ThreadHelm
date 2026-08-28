/**
 * Session host (T024): one dormant utility process per session.
 *
 * It creates no process at all until main has (1) delivered the session-bound
 * bootstrap secret over the private parent channel, (2) received `host.ready`,
 * (3) assigned this pid to the session's Job Object and verified membership,
 * and (4) sent exactly one `host.launch` carrying the same secret plus the
 * output MessagePort. That ordering is the whole point — a descendant created
 * before containment could never be contained afterwards.
 *
 * Protocol: contracts/session-host.md. Raw PTY bytes are never logged here;
 * debug output uses fixed event names, sizes, sequences, and stable codes.
 */

import type { MessagePortMain } from 'electron';
import { isAbsolute } from 'node:path';
import {
  MainToHostMessage,
  PROTOCOL_VERSION,
  type HostFailureCode,
  type HostToMainMessage,
  type LaunchDescriptor,
} from '@threadhelm/contracts';
import { OutputStream } from './backpressure.js';
import { createPty, type SessionPty } from './pty.js';
import { ControlQueue, type ControlOp } from './resize.js';

type Phase = 'awaiting_bootstrap' | 'dormant' | 'launched' | 'stopping' | 'exited';

// A dormant host that never hears from main again must not linger.
const BOOTSTRAP_TIMEOUT_MS = 10_000;
const LAUNCH_TIMEOUT_MS = 30_000;

const parentPort = process.parentPort;

let phase: Phase = 'awaiting_bootstrap';
let sessionId: string | undefined;
let bootstrapSecret: string | undefined;
let pty: SessionPty | undefined;
let stream: OutputStream | undefined;
let queue: ControlQueue | undefined;
let exitCode: number | null | undefined;
let stopDeadline: ReturnType<typeof setTimeout> | undefined;
let stopSequence: number | undefined;

function send(message: HostToMainMessage): void {
  parentPort.postMessage(message);
}

function fail(code: HostFailureCode, detail?: string, fatal = true): void {
  if (sessionId) send({ type: 'host.failure', sessionId, code, ...(detail ? { detail } : {}) });
  if (fatal) shutdown(1);
}

function shutdown(code: number): void {
  if (stopDeadline) clearTimeout(stopDeadline);
  stream?.close();
  try {
    pty?.kill();
  } catch {
    /* already gone */
  }
  phase = 'exited';
  process.exit(code);
}

let watchdog: ReturnType<typeof setTimeout> = setTimeout(
  () => fail('HOST_LAUNCH_TIMEOUT', 'no bootstrap'),
  BOOTSTRAP_TIMEOUT_MS,
);

function armWatchdog(ms: number, detail: string): void {
  clearTimeout(watchdog);
  watchdog = setTimeout(() => fail('HOST_LAUNCH_TIMEOUT', detail), ms);
}

function validDescriptor(descriptor: LaunchDescriptor): boolean {
  return (
    isAbsolute(descriptor.executable) &&
    /^[a-zA-Z]:\\/.test(descriptor.executable) &&
    isAbsolute(descriptor.cwd) &&
    descriptor.args.every((arg) => !arg.includes('\0'))
  );
}

function launch(
  message: Extract<MainToHostMessage, { type: 'host.launch' }>,
  ports: MessagePortMain[],
): void {
  if (phase !== 'dormant') return fail('HOST_ALREADY_LAUNCHED');
  if (message.sessionId !== sessionId) return fail('HOST_IDENTITY_MISMATCH');
  if (message.bootstrapSecret !== bootstrapSecret) return fail('HOST_BAD_SECRET');
  if (!validDescriptor(message.descriptor)) return fail('HOST_INVALID_MESSAGE', 'descriptor');
  const port = ports[0];
  if (!port) return fail('HOST_INVALID_MESSAGE', 'missing stream port');
  clearTimeout(watchdog);
  // The secret is single-use; forget it so a replay cannot match.
  bootstrapSecret = undefined;

  try {
    pty = createPty(message.descriptor);
  } catch {
    return fail('PTY_CREATE_FAILED');
  }
  phase = 'launched';
  const id = sessionId!;
  const livePty = pty;

  stream = new OutputStream(id, port, {
    pause: () => livePty.pause(),
    resume: () => livePty.resume(),
    onTruncated: (truncationCount) =>
      send({ type: 'host.outputTruncated', sessionId: id, truncationCount }),
    onViolation: (code, detail) => fail(code, detail),
  });

  queue = new ControlQueue({
    apply: applyControl,
    applied: (controlSequence) =>
      send({ type: 'host.controlApplied', sessionId: id, controlSequence }),
    rejected: (controlSequence) =>
      fail('HOST_INVALID_MESSAGE', `control ${controlSequence} out of order`),
  });

  livePty.onData((chunk) => stream?.push(chunk));
  livePty.onExit((code) => {
    exitCode = code;
    if (stopDeadline) clearTimeout(stopDeadline);
    // Dispose the pseudoconsole now: its helper process (OpenConsole/conhost)
    // lives inside the Job Object and would otherwise keep the scope non-empty.
    try {
      livePty.kill();
    } catch {
      /* already closed */
    }
    // Everything node-pty had for us has already been delivered to onData.
    send({ type: 'host.exit', sessionId: id, exitCode: code, drained: true });
    phase = 'exited';
  });

  send({ type: 'host.launched', sessionId: id, rootPid: livePty.pid });
}

async function applyControl(op: ControlOp): Promise<void> {
  const livePty = pty;
  if (!livePty || phase === 'exited') return;
  switch (op.kind) {
    case 'input':
      if (phase === 'stopping') {
        fail('INPUT_REJECTED', undefined, false);
        return;
      }
      livePty.write(op.bytes);
      return;
    case 'resize':
      livePty.resize(op.columns, op.rows);
      return;
    case 'interrupt':
      livePty.write('\x03');
      return;
    case 'cleanStop':
      phase = 'stopping';
      stopSequence = op.sequence;
      for (const text of op.writes) livePty.write(text);
      stopDeadline = setTimeout(() => {
        if (phase === 'stopping' && sessionId && stopSequence !== undefined) {
          send({ type: 'host.cleanStopTimeout', sessionId, controlSequence: stopSequence });
        }
      }, op.graceMs);
      return;
  }
}

parentPort.on('message', (event: { data: unknown; ports: MessagePortMain[] }) => {
  const parsed = MainToHostMessage.safeParse(event.data);
  if (!parsed.success) return fail('HOST_INVALID_MESSAGE', 'schema');
  const message = parsed.data;

  if (message.type === 'host.bootstrap') {
    if (phase !== 'awaiting_bootstrap') return fail('HOST_INVALID_MESSAGE', 'double bootstrap');
    const id = message.sessionId;
    sessionId = id;
    bootstrapSecret = message.bootstrapSecret;
    phase = 'dormant';
    armWatchdog(LAUNCH_TIMEOUT_MS, 'no launch');
    send({
      type: 'host.ready',
      sessionId: id,
      hostPid: process.pid,
      protocolVersion: PROTOCOL_VERSION,
    });
    return;
  }

  if (message.sessionId !== sessionId) return fail('HOST_IDENTITY_MISMATCH');

  switch (message.type) {
    case 'host.launch':
      launch(message, event.ports);
      return;
    case 'host.input':
      queue?.enqueue({ kind: 'input', sequence: message.controlSequence, bytes: message.bytes });
      return;
    case 'host.resize':
      queue?.enqueue({
        kind: 'resize',
        sequence: message.controlSequence,
        columns: message.columns,
        rows: message.rows,
      });
      return;
    case 'host.interrupt':
      queue?.enqueue({ kind: 'interrupt', sequence: message.controlSequence });
      return;
    case 'host.cleanStop':
      queue?.enqueue({
        kind: 'cleanStop',
        sequence: message.controlSequence,
        writes: message.action.writes,
        graceMs: message.action.graceMs,
      });
      return;
    case 'host.pauseOutput':
      pty?.pause();
      return;
    case 'host.resumeOutput':
      pty?.resume();
      return;
    case 'host.shutdown':
      // Main only sends this after the Job Object is verified empty.
      shutdown(exitCode === undefined ? 0 : 0);
      return;
  }
});
