/** DOM-free error type so pure modules (and their tests) never touch `window`. */

import type { ErrorCode, SerializedError } from '@threadhelm/contracts';

export class RendererError extends Error {
  readonly code: ErrorCode;
  readonly details: Readonly<Record<string, string | number | boolean>>;

  constructor(error: SerializedError) {
    super(error.message);
    this.name = 'RendererError';
    this.code = error.code;
    this.details = error.details;
  }
}

export function errorCode(error: unknown): ErrorCode {
  return error instanceof RendererError ? error.code : 'INTERNAL';
}
