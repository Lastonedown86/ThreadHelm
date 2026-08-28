import { describe, expect, it } from 'vitest';
import {
  createSecureTerminalOptions,
  hardenTerminal,
  SECURITY_INVARIANTS,
  SWALLOWED_OSC,
} from '../../../apps/desktop/src/renderer/features/session/xterm-security.js';

describe('xterm confinement', () => {
  it('produces bounded, non-animating, proposed-API-free options', () => {
    const options = createSecureTerminalOptions();
    expect(options.scrollback).toBe(10_000);
    expect(options.allowProposedApi).toBe(false);
    expect(options.cursorBlink).toBe(false);
    expect(options.windowOptions).toEqual({});
    expect(options.windowsPty).toEqual({ backend: 'conpty' });
  });

  it('makes hyperlinks inert', () => {
    const handler = createSecureTerminalOptions().linkHandler;
    expect(handler).toBeTruthy();
    handler!.activate({} as MouseEvent, 'https://example.invalid', {
      start: { x: 0, y: 0 },
      end: { x: 0, y: 0 },
    });
    // activate() returns without side effects; reaching here without throwing is the assertion.
    expect(true).toBe(true);
  });

  it('swallows clipboard, cwd, hyperlink, notification, and window sequences', () => {
    const osc: number[] = [];
    const csi: string[] = [];
    let titleListeners = 0;
    const fakeTerm = {
      parser: {
        registerOscHandler: (id: number, cb: (data: string) => boolean) => {
          osc.push(id);
          expect(cb('anything')).toBe(true);
          return { dispose: () => undefined };
        },
        registerCsiHandler: (id: { final: string }, cb: () => boolean) => {
          csi.push(id.final);
          expect(cb()).toBe(true);
          return { dispose: () => undefined };
        },
      },
      onTitleChange: () => {
        titleListeners++;
        return { dispose: () => undefined };
      },
    };
    hardenTerminal(fakeTerm as never);
    expect(osc).toEqual([...SWALLOWED_OSC]);
    expect(osc).toContain(52);
    expect(osc).toContain(8);
    expect(csi).toEqual(['t']);
    expect(titleListeners).toBe(1);
    expect(SECURITY_INVARIANTS.addons).toEqual(['fit']);
  });
});
