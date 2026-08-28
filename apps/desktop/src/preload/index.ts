/**
 * Renderer bridge (T025).
 *
 * One named method per approved operation, generated from the contract's
 * operation table so nothing unlisted can be reached. No `ipcRenderer`,
 * channel name, filesystem, environment, shell, or executable access crosses
 * into the renderer. Results travel as `{ ok, value | error }` envelopes so
 * stable error codes survive the context bridge.
 */

import { contextBridge, ipcRenderer } from 'electron';
import {
  eventNames,
  operationNames,
  STREAM_PORT_CHANNEL,
  type EventName,
  type EventPayload,
  type OperationName,
  type OperationRequest,
  type OperationResponse,
  type SerializedError,
} from '@threadhelm/contracts';

export type Envelope<T> = { ok: true; value: T } | { ok: false; error: SerializedError };

type Method<N extends OperationName> = (
  request: OperationRequest<N>,
) => Promise<Envelope<OperationResponse<N>>>;

type Namespace = OperationName extends `${infer S}.${string}` ? S : never;
type Namespaces = {
  [S in Namespace]: {
    [M in OperationName as M extends `${S}.${infer R}` ? R : never]: Method<M>;
  };
};

const namespaces: Record<string, Record<string, (request: unknown) => Promise<unknown>>> = {};
for (const name of operationNames) {
  const [namespace, method] = name.split('.') as [string, string];
  // Each closure pins its own channel: the renderer can pick a method, never a channel.
  const channel = `op:${name}`;
  (namespaces[namespace] ??= {})[method] = (request: unknown) =>
    ipcRenderer.invoke(channel, request);
}

const listeners = new Map<string, Set<(payload: unknown) => void>>();
for (const name of eventNames) {
  ipcRenderer.on(`event:${name}`, (_event, payload: unknown) => {
    for (const listener of listeners.get(name) ?? []) listener(payload);
  });
}

// A transferred MessagePort cannot be handed through the context bridge, so
// it is re-posted to the renderer's own window; the renderer picks it up from
// a `message` event whose data names the session.
ipcRenderer.on(STREAM_PORT_CHANNEL, (event, message: { sessionId: string }) => {
  window.postMessage({ type: STREAM_PORT_CHANNEL, sessionId: message.sessionId }, '*', event.ports);
});

const api = {
  ...(namespaces as Namespaces),
  on<N extends EventName>(name: N, listener: (payload: EventPayload<N>) => void): () => void {
    if (!eventNames.includes(name)) throw new Error('unknown event');
    const set = listeners.get(name) ?? new Set();
    set.add(listener as (payload: unknown) => void);
    listeners.set(name, set);
    return () => set.delete(listener as (payload: unknown) => void);
  },
  streamPortChannel: STREAM_PORT_CHANNEL,
};

export type ThreadHelmApi = typeof api;

contextBridge.exposeInMainWorld('threadhelm', api);
