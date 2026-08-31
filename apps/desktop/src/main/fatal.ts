import { writeSync } from 'node:fs';

/** Suppress Electron's blocking default dialog without inspecting exception content. */
export function installFatalExceptionHandler(): void {
  process.on('uncaughtException', () => {
    try {
      // Synchronous, fixed-size output cannot expose a thrown value or its getters.
      writeSync(2, '\nTHREADHELM_FATAL UNCAUGHT_EXCEPTION\n');
    } catch {
      // A broken diagnostic descriptor must not prevent fatal termination.
    } finally {
      process.exit(1);
    }
  });
}
