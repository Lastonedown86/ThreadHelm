/**
 * Attaches the pure router to Electron's ipcMain and gives services a typed
 * way to emit contract events to the renderer window.
 */

import { ipcMain, type BrowserWindow, type MessagePortMain } from 'electron';
import {
  events,
  operationNames,
  STREAM_PORT_CHANNEL,
  type EventName,
  type EventPayload,
} from '@threadhelm/contracts';
import type { Router } from './router.js';

export function bindRouter(router: Router): void {
  for (const name of operationNames) {
    ipcMain.handle(`op:${name}`, (event, payload: unknown) =>
      router.dispatch(name, payload, {
        frameUrl: event.senderFrame?.url ?? '',
        isMainFrame: event.senderFrame !== null && event.senderFrame === event.sender.mainFrame,
      }),
    );
  }
}

export interface RendererEvents {
  emit<N extends EventName>(name: N, payload: EventPayload<N>): void;
  transferStreamPort(sessionId: string, port: MessagePortMain): void;
}

export function createRendererEvents(getWindow: () => BrowserWindow | null): RendererEvents {
  return {
    emit(name, payload) {
      const window = getWindow();
      if (!window || window.isDestroyed()) return;
      // Parse on the way out too: an event can only carry contract fields.
      window.webContents.send(`event:${name}`, events[name].parse(payload));
    },
    transferStreamPort(sessionId, port) {
      const window = getWindow();
      if (!window || window.isDestroyed()) {
        port.close();
        return;
      }
      window.webContents.postMessage(STREAM_PORT_CHANNEL, { sessionId }, [port]);
    },
  };
}
