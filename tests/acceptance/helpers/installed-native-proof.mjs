// Native loading must remain in this short-lived subprocess: Windows retains DLL
// mappings after require-cache removal and would otherwise prevent real uninstall.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const [nativeFile, bridge, reportRoot] = process.argv.slice(2);
if (!nativeFile || !bridge || !reportRoot) throw new Error('NATIVE_PROOF_ARGUMENTS');
const native = createRequire(import.meta.url)(nativeFile);
const phases = {};
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
try {
  for (const mode of ['terminate', 'close']) {
    const sessionId = randomUUID();
    const config = join(reportRoot, `bridge-${mode}.json`);
    writeFileSync(
      config,
      JSON.stringify({
        version: 1,
        pipeName: `\\\\.\\pipe\\threadhelm-install-${sessionId}`,
        sessionId,
        credential: `disposable-proof-${randomUUID()}-${randomUUID()}`,
      }),
    );
    const token = native.createKillOnCloseJob(sessionId);
    let closed = false;
    const child = spawn(
      process.execPath,
      [join(import.meta.dirname, 'installed-bridge-child.mjs')],
      { stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true },
    );
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('DORMANT_HELPER_TIMEOUT')), 10000);
        child.once('message', (message) => {
          clearTimeout(timer);
          if (message?.ready) resolve();
          else reject(new Error('DORMANT_HELPER_INVALID'));
        });
        child.once('error', () => {
          clearTimeout(timer);
          reject(new Error('DORMANT_HELPER_FAILED'));
        });
      });
      native.assignProcess(token, child.pid);
      assert.equal(native.verifyProcessInJob(token, child.pid), true);
      assert.equal(native.inspectJob(token).activeProcessCount, 1);
      const bridgePid = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('INSTALLED_BRIDGE_TIMEOUT')), 10000);
        child.once('message', (message) => {
          clearTimeout(timer);
          if (Number.isSafeInteger(message?.bridgePid) && message.bridgePid > 0)
            resolve(message.bridgePid);
          else reject(new Error('INSTALLED_BRIDGE_FAILED'));
        });
        child.send({ bridge, config });
      });
      assert.equal(native.verifyProcessInJob(token, bridgePid), true);
      const snapshot = native.inspectJob(token);
      assert.equal(snapshot.truncated, false);
      assert.ok(snapshot.processIds.includes(bridgePid));
      if (mode === 'terminate') assert.equal(native.terminateJob(token, 1).activeProcessCount, 0);
      native.closeJob(token);
      closed = true;
      const deadline = Date.now() + 30000;
      while ((alive(child.pid) || alive(bridgePid)) && Date.now() < deadline)
        await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(alive(child.pid) || alive(bridgePid), false);
      phases[mode] = true;
    } finally {
      try {
        if (!closed) native.closeJob(token);
      } finally {
        child.kill();
        writeFileSync(config, '');
      }
    }
  }
  console.log(
    'THREADHELM_NATIVE_PROOF ' +
      JSON.stringify({
        nativeFile,
        bridge,
        phases,
        scope: 'installed-native-addon-and-real-bridge',
        passed: true,
      }),
  );
} catch {
  console.log(
    'THREADHELM_NATIVE_PROOF ' +
      JSON.stringify({ phases, passed: false, failure: 'INSTALLED_NATIVE_PROOF_FAILED' }),
  );
  process.exitCode = 1;
}
