import { statSync } from 'node:fs';
import { win32 } from 'node:path';

export interface ProofInvocation {
  fixtureArgs: string[];
  executable?: string;
}

/** Explicit local diagnostics only. This does not select or authorize production providers. */
export function selectProofInvocation(
  argv: readonly string[],
  platform: string,
  isFile: (path: string) => boolean = (path) => {
    try {
      return statSync(path).isFile();
    } catch {
      return false;
    }
  },
): ProofInvocation | undefined {
  const selected = argv.flatMap((arg, index) =>
    arg === '--threadhelm-proof' || arg === '--threadhelm-proof-node' ? [index] : [],
  );
  if (!selected.length) return undefined;
  if (selected.length !== 1) throw new Error('INVALID_PROOF_INVOCATION');
  const index = selected[0]!;
  if (argv[index] === '--threadhelm-proof') return { fixtureArgs: argv.slice(index + 1) };
  const executable = argv[index + 1];
  const fixtureArgs = argv.slice(index + 2);
  if (!executable || !fixtureArgs.length) throw new Error('INVALID_PROOF_INVOCATION');
  if (
    platform !== 'win32' ||
    !/^[a-z]:\\/i.test(executable) ||
    win32.basename(executable).toLowerCase() !== 'node.exe' ||
    executable.includes('\0') ||
    !isFile(executable)
  )
    throw new Error('INVALID_PROOF_NODE');
  return { executable, fixtureArgs };
}
