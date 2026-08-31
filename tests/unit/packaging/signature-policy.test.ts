import { describe, expect, it } from 'vitest';
import { assertReleaseSignatureStatus } from '../../../apps/desktop/src/packaging/signature-policy.js';

describe('unsigned release signature policy', () => {
  it.each(['NotSigned', 'Valid'])('accepts %s without a local override', (status) => {
    expect(() => assertReleaseSignatureStatus(status, 'ThreadHelm.exe')).not.toThrow();
  });

  it.each(['HashMismatch', 'NotTrusted', 'UnknownError', 'NotSupportedFileFormat', '', 'valid'])(
    'rejects %s rather than treating it as unsigned',
    (status) => {
      expect(() => assertReleaseSignatureStatus(status, 'ThreadHelm.exe')).toThrow(
        'Unacceptable Authenticode status',
      );
    },
  );
});
