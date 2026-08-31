import { describe, expect, it } from 'vitest';
import { isolatedProof } from '../../acceptance/helpers/isolated-proof.js';

describe('native proof process lifetime', () => {
  it('waits for process exit after the success marker, so a native module cannot remain mapped during uninstall', async () => {
    const proof = await isolatedProof(process.execPath, [
      '-e',
      `process.stdout.write('THREADHELM_NATIVE_PROOF '+JSON.stringify({pid:process.pid})+'\\n'); setTimeout(()=>process.exit(0),250);`,
    ]);
    expect(proof.code).toBe(0);
    expect(() => process.kill(Number(proof.result.pid), 0)).toThrow();
  });
  it('retains a failed subprocess exit even after a valid marker', async () => {
    const proof = await isolatedProof(process.execPath, [
      '-e',
      `console.log('THREADHELM_NATIVE_PROOF {}'); process.exit(7);`,
    ]);
    expect(proof.code).toBe(7);
  });
  it('kills and waits for a hung child instead of accepting its early marker', async () => {
    await expect(
      isolatedProof(
        process.execPath,
        ['-e', `console.log('THREADHELM_NATIVE_PROOF {}'); setInterval(()=>{},1000);`],
        200,
      ),
    ).rejects.toThrow('PROOF_PROCESS_TIMEOUT');
  });
  it('bounds combined output and rejects missing proof markers', async () => {
    await expect(
      isolatedProof(process.execPath, [
        '-e',
        `process.stderr.write('x'.repeat(70000));setInterval(()=>{},1000);`,
      ]),
    ).rejects.toThrow('PROOF_PROCESS_OUTPUT_LIMIT');
    await expect(
      isolatedProof(process.execPath, ['-e', `console.log('no marker');`]),
    ).rejects.toThrow('PROOF_RESULT_INVALID');
  });
});
