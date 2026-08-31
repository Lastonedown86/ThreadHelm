import { spawn } from 'node:child_process';

/** A proof is complete only after its process closes and releases native DLL mappings. */
export function isolatedProof(
  executable: string,
  args: string[],
  timeoutMs = 120_000,
): Promise<{ code: number | null; result: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '';
    let bytes = 0;
    let failure: string | undefined;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const stop = (code: string) => {
      if (failure) return;
      failure = code;
      child.kill();
      killTimer = setTimeout(() => reject(new Error('PROOF_PROCESS_DID_NOT_CLOSE')), 5_000);
    };
    const timer = setTimeout(() => stop('PROOF_PROCESS_TIMEOUT'), timeoutMs);
    const collect = (chunk: Buffer, output: boolean) => {
      bytes += chunk.length;
      if (bytes > 64 * 1024) stop('PROOF_PROCESS_OUTPUT_LIMIT');
      else if (output) stdout += chunk.toString('utf8');
    };
    child.stdout.on('data', (chunk: Buffer) => collect(chunk, true));
    child.stderr.on('data', (chunk: Buffer) => collect(chunk, false));
    child.once('error', () => {
      clearTimeout(timer);
      reject(new Error('PROOF_PROCESS_START_FAILED'));
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      if (failure) return reject(new Error(failure));
      try {
        const lines = stdout
          .split(/\r?\n/)
          .filter((line) => line.startsWith('THREADHELM_NATIVE_PROOF '));
        if (lines.length !== 1) throw new Error('PROOF_RESULT_COUNT');
        const result: unknown = JSON.parse(lines[0]!.slice('THREADHELM_NATIVE_PROOF '.length));
        if (!result || typeof result !== 'object' || Array.isArray(result))
          throw new Error('PROOF_RESULT_TYPE');
        resolve({ code, result: result as Record<string, unknown> });
      } catch {
        reject(new Error('PROOF_RESULT_INVALID'));
      }
    });
  });
}
