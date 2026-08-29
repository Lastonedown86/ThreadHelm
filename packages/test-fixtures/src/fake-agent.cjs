#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Deterministic fake terminal agent (T023). Plain CommonJS, no dependencies,
 * so it runs under any Node/Electron runtime without a build step.
 *
 *   node fake-agent.cjs --mode <echo|burst|control|ignore-interrupt|spawn-children|spawn-bridge> [--lines N]
 *
 * Under ConPTY stdin is raw: 0x03 is Ctrl+C, '\r' or '\n' ends a line.
 */
'use strict';

const { spawn } = require('node:child_process');
const { writeFileSync } = require('node:fs');

// Interactive agent CLIs put their terminal into raw mode. Without this,
// ConPTY converts 0x03 into a Windows console-control termination before the
// fixture can deterministically model handled and ignored interrupts.
if (typeof process.stdin.setRawMode === 'function') {
  process.stdin.setRawMode(true);
}

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
};
const mode = flag('mode', 'echo');
const lines = Number(flag('lines', '200000'));
const readyFile = flag('ready-file', '');
const bridgePath = flag('bridge-path', '');
const sessionConfig = flag('session-config', '');
const descendantPidFile = flag('descendant-pid-file', '');

// Serialized writer: never drops data, respects backpressure via drain.
const queue = [];
let writing = false;
function write(chunk) {
  queue.push(chunk);
  if (!writing) pump();
}
function pump() {
  writing = true;
  while (queue.length > 0) {
    const chunk = queue.shift();
    if (!process.stdout.write(chunk)) {
      process.stdout.once('drain', pump);
      return;
    }
  }
  writing = false;
}

let ignoreInterrupt = false;
function onInterrupt() {
  if (ignoreInterrupt) {
    write('IGNORED_INTERRUPT\n');
    return;
  }
  write('INTERRUPTED\n');
}
process.on('SIGINT', onInterrupt);

function onLine(line) {
  if (line === 'exit') {
    write('EXITING\n');
    // Let the writer flush before exiting.
    setImmediate(() => process.exit(0));
    return;
  }
  if (ignoreInterrupt && (line === '/quit' || line === '/exit')) {
    write('IGNORED_STOP\n');
    return;
  }
  write(`ECHO:${line}\n`);
}

let pending = '';
process.stdin.on('data', (buf) => {
  for (const byte of buf) {
    if (byte === 0x03) {
      onInterrupt();
      continue;
    }
    if (byte === 0x0d || byte === 0x0a) {
      if (pending.length > 0 || byte === 0x0a) {
        const line = pending;
        pending = '';
        if (line.length > 0) onLine(line);
      }
      continue;
    }
    pending += String.fromCharCode(byte);
  }
});
process.stdin.on('end', () => {
  /* keep running; a PTY may close stdin late */
});
process.stdin.resume();

// The integration harness uses this test-only marker to avoid racing a
// control write against Node's terminal initialization. It is created only
// after raw mode and input handlers are active.
if (readyFile) writeFileSync(readyFile, String(process.pid), 'utf8');

function burst() {
  const text = 'x'.repeat(78);
  let i = 0;
  const step = () => {
    let budget = 2000;
    while (i < lines && budget > 0) {
      write(`${String(i).padStart(7, '0')} ${text}\n`);
      i += 1;
      budget -= 1;
    }
    if (i < lines) setImmediate(step);
    else write('BURST_DONE\n');
  };
  step();
}

function control() {
  const ESC = '\x1b';
  const BEL = '\x07';
  const ST = `${ESC}\\`;
  write(`${ESC}]52;c;${Buffer.from('CLIPBOARD_SHOULD_NOT_CHANGE').toString('base64')}${BEL}`);
  write(`${ESC}]8;;https://example.invalid/should-not-open${BEL}link${ESC}]8;;${BEL}\n`);
  write(`${ESC}]0;TITLE_SHOULD_NOT_BE_TRUSTED${BEL}`);
  write(`${ESC}]7;file://localhost/C:/should-not-change-cwd${BEL}`);
  write(`${ESC}[2t${ESC}[3;0;0t${ESC}[8;50;200t`); // window manipulation
  write(`${ESC}Pq#0;2;0;0;0#0~~@@${ST}`); // DCS (sixel-shaped)
  write(Buffer.from([0xc3, 0x28, 0xa0, 0xa1, 0xe2, 0x28, 0xa1, 0xf0, 0x90, 0x28, 0xbc])); // malformed UTF-8
  write(Buffer.from([0x00, 0x00, 0x41, 0x00])); // NULs
  write('\nCONTROL_DONE\n');
}

switch (mode) {
  case 'echo':
    write('FAKE_AGENT_READY\n');
    break;
  case 'burst':
    write('FAKE_AGENT_READY\n');
    burst();
    break;
  case 'control':
    write('FAKE_AGENT_READY\n');
    control();
    break;
  case 'ignore-interrupt':
    ignoreInterrupt = true;
    write('FAKE_AGENT_READY\n');
    break;
  case 'spawn-children': {
    ignoreInterrupt = true;
    // Not detached: the Job Object must contain the grandchild.
    const child = spawn(process.execPath, [__filename, '--mode', 'ignore-interrupt'], {
      stdio: ['pipe', 'ignore', 'ignore'],
      windowsHide: true,
    });
    if (descendantPidFile) writeFileSync(descendantPidFile, String(child.pid), 'utf8');
    write(`FAKE_AGENT_READY\nCHILD_PID:${child.pid}\n`);
    break;
  }
  case 'spawn-bridge': {
    ignoreInterrupt = true;
    if (!bridgePath || !sessionConfig) {
      write('BRIDGE_CONFIG_MISSING\n');
      process.exit(2);
      break;
    }
    // This models a provider CLI spawning its configured MCP stdio child.
    // The provider fixture is already contained, so the bridge must inherit
    // the same non-breakaway Job Object.
    const child = spawn(bridgePath, ['--session-config', sessionConfig], {
      stdio: ['pipe', 'ignore', 'ignore'],
      windowsHide: true,
    });
    if (descendantPidFile) writeFileSync(descendantPidFile, String(child.pid), 'utf8');
    child.once('error', () => write('BRIDGE_SPAWN_FAILED\n'));
    write(`FAKE_AGENT_READY\nBRIDGE_PID:${child.pid}\n`);
    break;
  }
  default:
    write(`UNKNOWN_MODE:${mode}\n`);
    process.exit(2);
}
