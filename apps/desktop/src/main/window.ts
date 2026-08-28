/**
 * Electron security baseline (T027). Fuses live in forge.config.ts.
 *
 * Sandboxed renderer, context isolation, no Node integration, strict CSP,
 * and a deny-by-default posture for navigation, new windows, permissions,
 * downloads, and webviews. Only the bundled local UI is ever loaded.
 */

import { app, BrowserWindow, session, type WebContents } from 'electron';
import { pathToFileURL } from 'node:url';

export const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

export interface WindowPaths {
  preload: string;
  html: string;
}

let allowedOrigin: string | undefined;

/** The bundled renderer document URL (set once the window is created). */
export function allowedOriginUrl(): string {
  return allowedOrigin ?? '';
}

/** True only for the bundled renderer document. Used by the IPC router. */
export function isAllowedOrigin(frameUrl: string): boolean {
  if (!allowedOrigin) return false;
  return frameUrl === allowedOrigin;
}

function harden(contents: WebContents): void {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (event) => event.preventDefault());
  contents.on('will-redirect', (event) => event.preventDefault());
  contents.on('will-attach-webview', (event) => event.preventDefault());
  contents.on('will-frame-navigate', (event) => event.preventDefault());
  contents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  contents.session.setPermissionCheckHandler(() => false);
}

export function applyAppHardening(): void {
  app.on('web-contents-created', (_event, contents) => harden(contents));
}

export function applySessionHardening(): void {
  const defaultSession = session.defaultSession;
  defaultSession.on('will-download', (event) => event.preventDefault());
  defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  defaultSession.setPermissionCheckHandler(() => false);
  defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [CONTENT_SECURITY_POLICY],
      },
    });
  });
}

export function createMainWindow(paths: WindowPaths): BrowserWindow {
  allowedOrigin = pathToFileURL(paths.html).toString();
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    show: false,
    autoHideMenuBar: true,
    title: 'ThreadHelm',
    webPreferences: {
      preload: paths.preload,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      enableBlinkFeatures: '',
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  });
  window.once('ready-to-show', () => window.show());
  void window.loadFile(paths.html);
  return window;
}
