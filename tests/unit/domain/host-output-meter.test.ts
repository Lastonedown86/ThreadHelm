import { afterEach, describe, expect, it, vi } from 'vitest';
import { HostToMainMessage, MainToHostMessage } from '@threadhelm/contracts';
import {
  HostOutputMeter,
  forwardMeteredOutput,
} from '../../../apps/desktop/src/session-host/output-meter.js';
import { OutputStream } from '../../../apps/desktop/src/session-host/backpressure.js';

const sessionId = '00000000-0000-4000-8000-000000000001';
const attemptId = '00000000-0000-4000-8000-000000000002';
describe('content-free host byte meter', () => {
  afterEach(() => vi.useRealTimers());
  it('counts actual byte lengths before buffering and immediately pauses at a main-assigned ceiling', () => {
    vi.useFakeTimers();
    const events: unknown[] = [];
    const pause = vi.fn();
    const meter = new HostOutputMeter(sessionId, (event) => events.push(event), pause);
    meter.record(900);
    meter.setBudget(attemptId, 1024);
    expect(meter.record(1023)).toBe(1023);
    expect(meter.record(1)).toBe(1);
    expect(pause).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(0);
    expect(events.at(-1)).toMatchObject({
      type: 'host.outputProgress',
      sessionId,
      attemptId,
      outputBytes: 1024,
      totalOutputBytes: 1924,
      limitReached: true,
    });
    expect(meter.record(50)).toBe(0);
    expect(pause).toHaveBeenCalledOnce();
    meter.clearBudget(attemptId);
    expect(meter.record(1)).toBe(1);
    meter.close();
  });
  it('preserves the within-budget prefix of a ceiling-crossing chunk', () => {
    vi.useFakeTimers();
    const events: unknown[] = [];
    const meter = new HostOutputMeter(
      sessionId,
      (e) => events.push(e),
      () => {},
    );
    meter.setBudget(attemptId, 1024);
    expect(meter.record(900)).toBe(900);
    expect(meter.record(300)).toBe(124);
    vi.advanceTimersByTime(0);
    expect(events.at(-1)).toMatchObject({ outputBytes: 1200, limitReached: true });
    meter.close();
  });
  it('forwards the authorized bytes and discloses discarded output before shutdown', () => {
    vi.useFakeTimers();
    const frames: unknown[] = [];
    const notices: number[] = [];
    const stream = new OutputStream(
      sessionId,
      {
        postMessage: (message: unknown) => frames.push(message),
        on: () => {},
        start: () => {},
        close: () => {},
      },
      {
        pause: () => {},
        resume: () => {},
        onTruncated: (count) => notices.push(count),
        onViolation: () => {},
      },
    );
    const meter = new HostOutputMeter(
      sessionId,
      () => {},
      () => {},
    );
    meter.setBudget(attemptId, 4);
    forwardMeteredOutput(meter, stream, Buffer.from('abcdef'));
    const output = frames[0] as { kind: string; bytes: Uint8Array };
    expect(output.kind).toBe('output');
    expect(Buffer.from(output.bytes).toString()).toBe('abcd');
    expect(frames[1]).toMatchObject({ kind: 'truncated', sessionId, truncationCount: 1 });
    expect(notices).toEqual([1]);
    stream.close();
    meter.close();
  });
  it('coalesces ordinary telemetry and never turns output bytes into readiness or progress', () => {
    vi.useFakeTimers();
    const events: unknown[] = [];
    const meter = new HostOutputMeter(
      sessionId,
      (e) => events.push(e),
      () => {},
    );
    for (let i = 0; i < 1000; i++) meter.record(7);
    expect(events).toHaveLength(0);
    vi.advanceTimersByTime(100);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      attemptId: null,
      totalOutputBytes: 7000,
      outputBytes: 0,
      limitReached: false,
    });
    expect(JSON.stringify(events)).not.toMatch(/ready|body|text|transcript|madeProgress/);
    meter.close();
  });
  it('accepts only bounded content-free private protocol messages', () => {
    const message = {
      type: 'host.outputProgress',
      sessionId,
      attemptId,
      totalOutputBytes: 2,
      outputBytes: 2,
      sequence: 1,
      limitReached: false,
    };
    expect(HostToMainMessage.safeParse(message).success).toBe(true);
    expect(HostToMainMessage.safeParse({ ...message, transcript: 'raw bytes' }).success).toBe(
      false,
    );
    expect(
      MainToHostMessage.safeParse({
        type: 'host.setOutputBudget',
        sessionId,
        protocolVersion: 1,
        attemptId,
        maxOutputBytes: 1024,
      }).success,
    ).toBe(true);
  });
});
