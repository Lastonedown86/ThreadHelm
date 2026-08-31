/** A reported PID must identify an additional process in this exact proof scope. */
export function isProofDescendant(
  pid: number,
  scope: { hostPid: number; rootPid: number },
  verifyMembership: (pid: number) => boolean,
): boolean {
  return (
    Number.isSafeInteger(pid) &&
    pid > 0 &&
    pid !== scope.hostPid &&
    pid !== scope.rootPid &&
    verifyMembership(pid)
  );
}
