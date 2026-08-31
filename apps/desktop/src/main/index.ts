/**
 * Electron main entry.
 *
 * `--threadhelm-proof <fixture args…>` runs the architecture proof (T014)
 * headlessly and exits — against the packaged app too, which is the point.
 * Everything else is the coordinator in bootstrap.ts.
 */

import { app } from 'electron';
import { join } from 'node:path';
import { bootstrap } from './bootstrap.js';
import { installFatalExceptionHandler } from './fatal.js';
import { runProof } from './proof.js';

// Electron's default handler pops a modal error box, which blocks a headless
// or CI run forever. Registering a handler replaces that with a printed line.
installFatalExceptionHandler();

const PROOF_FLAG = '--threadhelm-proof';
const paths = {
  hostEntry: join(__dirname, 'session-host.cjs'),
  preload: join(__dirname, '../preload/index.cjs'),
  html: join(__dirname, '../renderer/index.html'),
};

const proofIndex = process.argv.indexOf(PROOF_FLAG);
if (proofIndex >= 0) {
  void app.whenReady().then(async () => {
    const fixtureArgs = process.argv.slice(proofIndex + 1);
    const result = await runProof(paths.hostEntry, fixtureArgs);
    // Marker-delimited so a harness can parse it out of packaged stdout.
    process.stdout.write(`\nTHREADHELM_PROOF ${JSON.stringify(result)}\n`);
    app.exit(result.passed ? 0 : 1);
  });
} else {
  bootstrap(paths);
}
