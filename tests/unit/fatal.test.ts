import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const moduleUrl = pathToFileURL(
  resolve(import.meta.dirname, '../../apps/desktop/src/main/fatal.ts'),
).href;
const expected = '\nTHREADHELM_FATAL UNCAUGHT_EXCEPTION\n';
// V8 prepares uncaught values before the event. Install accessors immediately
// before our listener so this checks the application's handler, not V8 formatting.
const forbidInspection = `process.prependListener('uncaughtException', (error) => {
  Object.defineProperties(error, Object.fromEntries(['toString', 'name', 'stack', 'message'].map((key) => [key, {
    configurable: true,
    get() { process.stdout.write('ACCESSED_' + key); throw new Error('PRIVATE_GETTER'); }
  }])));
});`;

describe('fatal exception privacy at the real Node event boundary', () => {
  it.each([
    {
      kind: 'Error',
      value:
        "Object.assign(new Error('PRIVATE_MESSAGE'), { name: 'PRIVATE_NAME', stack: 'PRIVATE_STACK' })",
      beforeHandler: '',
    },
    { kind: 'string', value: "'PRIVATE_PROVIDER_OUTPUT'", beforeHandler: '' },
    { kind: 'hostile object', value: '{}', beforeHandler: forbidInspection },
    {
      kind: 'hostile Error',
      value: "new Error('PRIVATE_MESSAGE')",
      beforeHandler: forbidInspection,
    },
  ])('does not inspect or print an uncaught $kind', ({ value, beforeHandler }) => {
    const script = `import { installFatalExceptionHandler } from ${JSON.stringify(moduleUrl)};
      installFatalExceptionHandler();
      ${beforeHandler}
      const value = ${value};
      setImmediate(() => { throw value; });`;
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
    });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(expected);
  });

  it('still exits nonzero when the fatal diagnostic write fails', () => {
    const script = `import fs from 'node:fs';
      import { syncBuiltinESMExports } from 'node:module';
      import { installFatalExceptionHandler } from ${JSON.stringify(moduleUrl)};
      installFatalExceptionHandler();
      fs.writeSync = () => { throw new Error('PRIVATE_SINK_FAILURE'); };
      syncBuiltinESMExports();
      setImmediate(() => { throw new Error('PRIVATE_MESSAGE'); });`;
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });
});
