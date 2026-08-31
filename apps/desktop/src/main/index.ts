/**
 * Electron main entry.
 *
 * `--threadhelm-proof <fixture args…>` runs the architecture proof (T014)
 * headlessly and exits — against the packaged app too, which is the point.
 * Everything else is the coordinator in bootstrap.ts.
 */

import { app } from 'electron';
import { join } from 'node:path';
import { installFatalExceptionHandler } from './fatal.js';
import { selectProofInvocation } from './proof-options.js';
import { handleSquirrelLifecycle } from './squirrel-lifecycle.js';

// Electron's default handler pops a modal error box, which blocks a headless
// or CI run forever. Registering a handler replaces that with a printed line.
installFatalExceptionHandler();

function failStartup(): void {
  // A rejected import must reach the same fixed, synchronous fatal handler as
  // an uncaught exception. Never inspect or rethrow its potentially private value.
  queueMicrotask(() => {
    throw new Error('MAIN_STARTUP_FAILED');
  });
}

const paths = {
  hostEntry: join(__dirname, 'session-host.cjs'),
  preload: join(__dirname, '../preload/index.cjs'),
  html: join(__dirname, '../renderer/index.html'),
};

const lifecycle = handleSquirrelLifecycle(process.platform, process.argv, process.execPath);
if (lifecycle) {
  void lifecycle.then((exitCode) => app.exit(exitCode)).catch(failStartup);
} else {
  startApplication();
}

function startApplication(): void {
  let proof: ReturnType<typeof selectProofInvocation>;
  try {
    proof = selectProofInvocation(process.argv, process.platform);
  } catch {
    // Malformed diagnostic flags must never fall through to normal startup.
    process.stdout.write(
      '\nTHREADHELM_PROOF {"passed":false,"steps":{},"failure":"INVALID_PROOF_INVOCATION"}\n',
    );
    app.exit(1);
    return;
  }
  if (proof) {
    const invocation = proof;
    void app
      .whenReady()
      .then(async () => {
        const { runProof } = await import('./proof.js');
        const result = await runProof(
          paths.hostEntry,
          invocation.fixtureArgs,
          invocation.executable,
        );
        // Marker-delimited so a harness can parse it out of packaged stdout.
        process.stdout.write(`\nTHREADHELM_PROOF ${JSON.stringify(result)}\n`);
        app.exit(result.passed ? 0 : 1);
      })
      .catch(failStartup);
  } else {
    void import('./bootstrap.js').then(({ bootstrap }) => bootstrap(paths)).catch(failStartup);
  }
}
