/** Deliberately authored text is inert, but must not retain terminal controls or credentials. */
export function isSafeAuthoredText(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++index);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  // Preserve ordinary multiline/tab draft text; reject C0/C1 terminal controls.
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/u.test(value)) return false;
  return ![
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/u,
    /\b(api[_-]?key|access[_-]?token|password|secret)\s*[:=]\s*[^\s]{8,}/iu,
    /sk-[A-Za-z0-9_-]{8,}/,
    /sk-ant-/,
    /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{8,}/,
    /github_pat_/,
    /AKIA[0-9A-Z]{16}/,
    /xox[baprs]-/,
    /Bearer\s+\S{8,}/,
    /eyJ[A-Za-z0-9_-]{4,}\.eyJ[A-Za-z0-9_-]{4,}/,
    /\b\w*(?:TOKEN|SECRET|KEY|PASSWORD|PASSWD|AUTH|CREDENTIAL)\w*\s*=/i,
  ].some((pattern) => pattern.test(value));
}
