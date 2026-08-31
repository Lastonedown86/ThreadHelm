import { api, call } from '../../api.js';
import { TerminalController, type TerminalHooks } from './terminal-controller.js';

const controller = new TerminalController(
  () => import('./terminals.js'),
  (sessionId) => call(api.sessions.subscribeOutput({ sessionId })),
);

export function installTerminalHooks(hooks: TerminalHooks): () => void {
  const uninstall = controller.install(hooks);
  const onMessage = (event: MessageEvent) => {
    const data: unknown = event.data;
    if (!data || typeof data !== 'object') return;
    const { type, sessionId } = data as { type?: unknown; sessionId?: unknown };
    if (type !== api.streamPortChannel || typeof sessionId !== 'string') return;
    const port = event.ports[0];
    if (port) controller.receivePort(sessionId, port);
  };
  window.addEventListener('message', onMessage);
  return () => {
    window.removeEventListener('message', onMessage);
    uninstall();
  };
}

export const subscribeOutput = (sessionId: string): void => controller.subscribe(sessionId);
export const terminalSize = (sessionId: string) => controller.terminalSize(sessionId);

export async function loadTerminalPane() {
  await controller.load();
  return import('./Terminal.js');
}
