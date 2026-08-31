// Standalone diagnostic child: executed by installed Electron's real session host through ConPTY.
// It never loads a provider, user configuration, or a bundled test-fixture package.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const argument = (name) => {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error('DIAGNOSTIC_ARGUMENT_REQUIRED');
  return process.argv[index + 1];
};
const bridge = spawn(
  argument('--bridge-path'),
  ['--session-config', argument('--session-config')],
  {
    stdio: ['pipe', 'ignore', 'ignore'],
    windowsHide: true,
  },
);
bridge.once('spawn', () => {
  writeFileSync(argument('--descendant-pid-file'), String(bridge.pid));
  process.stdout.write(`BRIDGE_PID:${bridge.pid}\n`);
});
bridge.once('error', () => process.exit(1));
bridge.once('exit', () => process.exit(1));
