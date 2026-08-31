import { describe, expect, it } from 'vitest';
import { createLogger, sanitizeLogValue } from '../../apps/desktop/src/main/logging.js';

describe('content-free logging boundary', () => {
  it('redacts C1 controls, malformed Unicode and credential assignments', () => {
    for (const value of [
      '\ud800',
      '\u009b31m',
      'API_TOKEN=synthetic',
      'ghs_' + 'synthetic'.repeat(2),
      'secret: syntheticexample',
      '-----BEGIN PRIVATE KEY-----',
    ]) {
      expect(sanitizeLogValue(value)).toBe('[redacted]');
    }
  });

  it('does not permit content fields or child metadata to overwrite the log envelope', () => {
    const lines: string[] = [];
    const logger = createLogger(
      { write: (line) => lines.push(line) },
      { goal: 'private goal' },
      () => new Date('2026-08-30T00:00:00Z'),
    );
    logger.child({ exportPath: 'C:\\private\\target.hire.json' }).info('mission.changed', {
      event: 'forged',
      level: 'forged',
      ts: 'forged',
      body: 'private body',
      sessionId: '00000000-0000-4000-8000-000000000001',
      count: 2,
    });
    expect(JSON.parse(lines[0]!)).toMatchObject({
      event: 'mission.changed',
      level: 'info',
      ts: '2026-08-30T00:00:00.000Z',
      count: 2,
    });
    expect(lines[0]).not.toMatch(/private|forged/);
  });
});
