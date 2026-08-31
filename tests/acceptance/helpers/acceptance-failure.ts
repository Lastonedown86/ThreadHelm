import { isAbsolute, relative } from 'node:path';

/** Never retain raw failed assertions: they may contain startup logs or credentials. */
export function acceptanceFailure(
  name: string,
  errors: readonly { message?: string }[] | undefined,
  artifactRoot: string,
) {
  const messages = (errors ?? []).map((error) => error.message ?? '');
  for (const message of messages) {
    const match =
      /^(Native architecture does not match (?:x64|arm64)|Invalid native PE file|Unresolved package native link): ([^\r\n]+)$/.exec(
        message,
      );
    if (match) {
      const path = relative(artifactRoot, match[2]!);
      if (
        path &&
        !isAbsolute(path) &&
        path !== '..' &&
        !path.startsWith('..\\') &&
        !path.startsWith('../')
      )
        return { name: name.slice(0, 160), code: match[1], relativePath: path.slice(0, 500) };
    }
    if (message === 'UPDATER_IDENTITY_MISMATCH') return { name: name.slice(0, 160), code: message };
  }
  return { name: name.slice(0, 160), code: 'ASSERTION_OR_HOOK_FAILED' };
}
