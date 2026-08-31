/**
 * Real Electron implementations of the narrow interfaces in context.ts.
 * Everything Electron-specific about process topology lives here.
 */

import { dialog, MessageChannelMain, utilityProcess, type BrowserWindow } from 'electron';
import type {
  DirectoryPicker,
  AgentExportTargetPicker,
  HostHandle,
  HostSpawner,
  ProfileFilePicker,
  StreamChannelFactory,
} from './context.js';

export function electronHostSpawner(hostEntry: string): HostSpawner {
  return {
    spawn(sessionId) {
      // No command-line secrets, no inherited stdio: the host is dormant until
      // bootstrapped over the private channel.
      const child = utilityProcess.fork(hostEntry, [], {
        stdio: 'ignore',
        serviceName: `threadhelm-session-${sessionId.slice(0, 8)}`,
      });
      const handle: HostHandle = {
        get pid() {
          return child.pid;
        },
        postMessage(message, ports) {
          child.postMessage(message, ports ?? []);
        },
        onMessage(listener) {
          child.on('message', listener);
        },
        onExit(listener) {
          child.on('exit', listener);
        },
        kill() {
          child.kill();
        },
      };
      return handle;
    },
  };
}

export const electronChannels: StreamChannelFactory = {
  create() {
    const channel = new MessageChannelMain();
    return { hostPort: channel.port1, rendererPort: channel.port2 };
  },
};

export function electronPicker(getWindow: () => BrowserWindow | null): DirectoryPicker {
  return {
    async pickDirectory() {
      const window = getWindow();
      const options = {
        title: 'Choose a workspace folder',
        properties: ['openDirectory', 'dontAddToRecent'] as ('openDirectory' | 'dontAddToRecent')[],
      };
      const result = window
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options);
      if (result.canceled || result.filePaths.length !== 1) return null;
      return result.filePaths[0] ?? null;
    },
  };
}

export function electronProfileFilePicker(
  getWindow: () => BrowserWindow | null,
): ProfileFilePicker {
  return {
    async pickFile() {
      const window = getWindow();
      const options = {
        title: 'Choose an agent profile manifest',
        properties: ['openFile', 'dontAddToRecent'] as ('openFile' | 'dontAddToRecent')[],
        filters: [{ name: 'ThreadHelm hire manifests', extensions: ['json'] }],
      };
      const result = window
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options);
      if (result.canceled || result.filePaths.length !== 1) return null;
      return result.filePaths[0] ?? null;
    },
  };
}

export function electronAgentExportTargetPicker(
  getWindow: () => BrowserWindow | null,
): AgentExportTargetPicker {
  return {
    async pickTarget() {
      const window = getWindow();
      const options = {
        title: 'Export agent profile',
        defaultPath: 'agent.hire.json',
        filters: [{ name: 'ThreadHelm hire manifests', extensions: ['hire.json'] }],
      };
      const result = window
        ? await dialog.showSaveDialog(window, options)
        : await dialog.showSaveDialog(options);
      return result.canceled ? null : (result.filePath ?? null);
    },
  };
}
