/**
 * Unwraps preload envelopes into values or a typed error. Every call site goes
 * through `call` so stable error codes survive into the UI.
 */

import { RendererError } from './errors.js';
export { RendererError, errorCode } from './errors.js';
import type {
  EventName,
  EventPayload,
  OperationName,
  OperationRequest,
  OperationResponse,
  SerializedError,
} from '@threadhelm/contracts';

export type Envelope<T> = { ok: true; value: T } | { ok: false; error: SerializedError };

type Method<N extends OperationName> = (
  request: OperationRequest<N>,
) => Promise<Envelope<OperationResponse<N>>>;

type Namespace = OperationName extends `${infer S}.${string}` ? S : never;

/** `workspaces.choose` → `api.workspaces.choose(...)`, derived from the contract. */
export type ThreadHelmApi = {
  [S in Namespace]: {
    [M in OperationName as M extends `${S}.${infer R}` ? R : never]: Method<M>;
  };
} & {
  on<N extends EventName>(name: N, listener: (payload: EventPayload<N>) => void): () => void;
  streamPortChannel: string;
};

export async function call<T>(promise: Promise<Envelope<T>>): Promise<T> {
  const envelope = await promise;
  if (envelope.ok) return envelope.value;
  throw new RendererError(envelope.error);
}

export const api: ThreadHelmApi = window.threadhelm;
