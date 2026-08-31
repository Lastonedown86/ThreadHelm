/** Owner-approved unsigned distribution. An invalid signature is never unsigned. */
export function assertReleaseSignatureStatus(status: string, file: string): void {
  if (status !== 'NotSigned' && status !== 'Valid') {
    throw new Error(`Unacceptable Authenticode status ${status}: ${file}`);
  }
}
