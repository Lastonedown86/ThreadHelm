/**
 * One ConPTY per host (T045).
 *
 * The working directory is the canonical workspace, passed through the
 * process API — never through `cd` or a composed command line. Arguments come
 * from the validated launch descriptor only.
 */

import { spawn as spawnPty, type IPty } from 'node-pty';
import type { LaunchDescriptor } from '@threadhelm/contracts';

export interface SessionPty {
  readonly pid: number;
  write(data: string | Uint8Array): void;
  resize(columns: number, rows: number): void;
  pause(): void;
  resume(): void;
  kill(): void;
  onData(listener: (chunk: Buffer) => void): void;
  onExit(listener: (exitCode: number | null) => void): void;
}

/**
 * 'inherit-sanitized': the provider gets the user's environment minus anything
 * that would let it re-enter ThreadHelm's runtime or change how Node/Electron
 * start. Provider credentials stay wherever the provider keeps them.
 */
export function sanitizedEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    const upper = key.toUpperCase();
    if (upper.startsWith('ELECTRON_') || upper.startsWith('THREADHELM_')) continue;
    if (
      upper === 'NODE_OPTIONS' ||
      upper === 'NODE_CHANNEL_FD' ||
      upper === 'NODE_CHANNEL_SERIALIZATION_MODE'
    ) {
      continue;
    }
    env[key] = value;
  }
  env.TERM = 'xterm-256color';
  env.COLORTERM = 'truecolor';
  return env;
}

export function createPty(descriptor: LaunchDescriptor): SessionPty {
  // A .cmd shim is launched as cmd.exe /d /s /c "<already quoted by the
  // adapter>". node-pty would re-escape the embedded quotes, so the command
  // line is passed verbatim as one string for cmd.exe only.
  const cmdShim = /[\\/]cmd\.exe$/i.test(descriptor.executable);
  const args: string[] | string = cmdShim ? descriptor.args.join(' ') : [...descriptor.args];
  const pty: IPty = spawnPty(descriptor.executable, args, {
    name: 'xterm-256color',
    cols: descriptor.terminal.columns,
    rows: descriptor.terminal.rows,
    cwd: descriptor.cwd,
    env: sanitizedEnvironment(),
    useConpty: true,
    conptyInheritCursor: false,
  });

  return {
    pid: pty.pid,
    write(data) {
      pty.write(typeof data === 'string' ? data : Buffer.from(data).toString('utf8'));
    },
    resize(columns, rows) {
      pty.resize(columns, rows);
    },
    pause() {
      pty.pause();
    },
    resume() {
      pty.resume();
    },
    kill() {
      pty.kill();
    },
    onData(listener) {
      pty.onData((chunk) => listener(Buffer.from(chunk, 'utf8')));
    },
    onExit(listener) {
      pty.onExit(({ exitCode }) => listener(typeof exitCode === 'number' ? exitCode : null));
    },
  };
}
