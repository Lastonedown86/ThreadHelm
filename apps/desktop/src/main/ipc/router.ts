/**
 * IPC router (T026). Pure: no Electron import, so contract tests drive it
 * directly. `electron-binding.ts` attaches it to ipcMain.
 *
 * Every request is checked in this order: operation name is in the contract,
 * sender is the app's own main frame, payload parses against the request
 * schema, handler runs, and the response is re-parsed against the response
 * schema (Zod strips unknown keys, so nothing unreviewed leaks out).
 */

import {
  operationNames,
  operations,
  serializeError,
  ThreadHelmError,
  type OperationName,
  type OperationRequest,
  type OperationResponse,
  type SerializedError,
} from '@threadhelm/contracts';
import type { Logger } from '../logging.js';

export interface Sender {
  frameUrl: string;
  isMainFrame: boolean;
}

export interface RequestContext {
  sender: Sender;
}

export type Handlers = {
  [N in OperationName]: (
    request: OperationRequest<N>,
    context: RequestContext,
  ) => Promise<OperationResponse<N>> | OperationResponse<N>;
};

export type Envelope<T> = { ok: true; value: T } | { ok: false; error: SerializedError };

export interface Router {
  dispatch(name: string, payload: unknown, sender: Sender): Promise<Envelope<unknown>>;
}

export interface RouterOptions {
  isAllowedOrigin(frameUrl: string): boolean;
  log: Logger;
}

const MAX_PAYLOAD_BYTES = 256 * 1024;

function payloadTooLarge(payload: unknown): boolean {
  if (payload instanceof Uint8Array) return payload.byteLength > MAX_PAYLOAD_BYTES;
  if (payload && typeof payload === 'object') {
    let total = 0;
    for (const value of Object.values(payload as Record<string, unknown>)) {
      if (value instanceof Uint8Array) total += value.byteLength;
      else if (typeof value === 'string') total += value.length;
    }
    return total > MAX_PAYLOAD_BYTES;
  }
  return typeof payload === 'string' && payload.length > MAX_PAYLOAD_BYTES;
}

export function createRouter(handlers: Handlers, options: RouterOptions): Router {
  const known = new Set<string>(operationNames);

  return {
    async dispatch(name, payload, sender) {
      if (!known.has(name)) {
        options.log.warn('ipc.unknown_operation', { length: name.length });
        return failure(new ThreadHelmError('INVALID_REQUEST', 'Unknown operation.'));
      }
      const op = name as OperationName;
      if (!sender.isMainFrame || !options.isAllowedOrigin(sender.frameUrl)) {
        options.log.warn('ipc.unauthorized_sender', { operation: op });
        return failure(new ThreadHelmError('UNAUTHORIZED_SENDER', 'Request rejected.'));
      }
      if (payloadTooLarge(payload)) {
        return failure(new ThreadHelmError('INVALID_REQUEST', 'Payload too large.'));
      }
      const request = operations[op].request.safeParse(payload);
      if (!request.success) {
        options.log.warn('ipc.invalid_request', { operation: op });
        return failure(
          new ThreadHelmError('INVALID_REQUEST', 'Request did not match the contract.'),
        );
      }
      try {
        const handler = handlers[op] as (
          request: unknown,
          context: RequestContext,
        ) => Promise<unknown> | unknown;
        const raw = await handler(request.data, { sender });
        const response = operations[op].response.safeParse(raw);
        if (!response.success) {
          options.log.error('ipc.invalid_response', { operation: op });
          return failure(new ThreadHelmError('INTERNAL', 'Response did not match the contract.'));
        }
        return { ok: true, value: response.data };
      } catch (error) {
        if (!(error instanceof ThreadHelmError)) {
          options.log.error('ipc.handler_threw', {
            operation: op,
            errorName: error instanceof Error ? error.name : 'unknown',
          });
        }
        return failure(error);
      }
    },
  };
}

function failure(error: unknown): Envelope<never> {
  return { ok: false, error: serializeError(error) };
}
