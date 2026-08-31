// Dormant test harness, not an app/provider replacement. Only the installed bridge is executed.
import { spawn } from 'node:child_process';
process.send({ ready: true });
process.once('message', ({ bridge, config }) => {
  const child = spawn(bridge, ['--session-config', config], {
    stdio: ['pipe', 'ignore', 'ignore'],
    windowsHide: true,
  });
  child.once('spawn', () => process.send({ bridgePid: child.pid }));
  child.once('error', () => process.send({ error: 'BRIDGE_START_FAILED' }));
  // Keep the bridge's stdio session open until the real installed Job Object ends it.
});
