import { describe, expect, it } from 'vitest';
import { ThreadHelmError } from '@threadhelm/contracts';
import {
  assertNoRawContent,
  safeTemplate,
  sanitizeSummary,
  SUMMARY_TEMPLATE_IDS,
} from '@threadhelm/persistence';

const rejects = (input: string, reason = 'UNSAFE_SUMMARY') => {
  let caught: unknown;
  try {
    sanitizeSummary(input);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ThreadHelmError);
  expect((caught as ThreadHelmError).code).toBe('INVALID_REQUEST');
  expect((caught as ThreadHelmError).details.reason).toBe(reason);
};

describe('sanitizeSummary', () => {
  it('accepts plain allowlisted text', () => {
    expect(sanitizeSummary('Claude Code started with root pid 4242')).toBe(
      'Claude Code started with root pid 4242',
    );
  });

  it.each([
    ['ANSI colour', 'done \x1b[31mred\x1b[0m'],
    ['CSI byte', 'x\x9bcolor'],
    ['OSC title', '\x1b]0;title\x07'],
    ['newline', 'line one\nline two'],
    ['bell', 'ding\x07'],
    ['too long', 'a'.repeat(301)],
    ['empty', ''],
    ['openai key', 'used sk-abcdefghijklmnop'],
    ['anthropic key', 'sk-ant-api03-xyz'],
    ['github token', 'ghp_abcdefghijklmnop'],
    ['github pat', 'github_pat_11ABC'],
    ['aws key', 'AKIAABCDEFGHIJKLMNOP'],
    ['slack token', 'xoxb-1234'],
    ['bearer', 'Authorization Bearer abcdefghijkl'],
    ['jwt', 'eyJhbGciOi.eyJzdWIiOi.sig'],
    ['long hex', '0123456789abcdef0123456789abcdef'],
    ['long base64', 'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo='],
    ['env token', 'OPENAI_API_KEY=abc'],
    ['env password', 'password=hunter2'],
    ['stdout marker', 'stdout: hello'],
    ['probe marker', 'probe output: 1.2.3'],
    ['powershell prompt', 'PS C:\\Users\\me>'],
    ['chat marker', 'Human: do the thing'],
  ])('rejects %s', (_label, input) => rejects(input));
});

describe('assertNoRawContent', () => {
  it('passes paths and hex identifiers, rejects credentials and controls', () => {
    expect(() =>
      assertNoRawContent({
        path: 'C:\\Users\\Bill\\Documents\\my project ünïcode',
        fileId: '0123456789abcdef0123456789abcdef',
        count: 3,
      }),
    ).not.toThrow();
    for (const bad of ['\x1b[31m', 'sk-abcdefghijkl', 'API_TOKEN=x', 'ghp_abcdefghijkl']) {
      let caught: unknown;
      try {
        assertNoRawContent({ field: bad });
      } catch (error) {
        caught = error;
      }
      expect((caught as ThreadHelmError).details).toMatchObject({
        reason: 'UNSAFE_CONTENT',
        field: 'field',
      });
    }
  });
});

describe('safeTemplate', () => {
  it('produces stable strings from fixed templates', () => {
    expect(safeTemplate('launched', { provider: 'Codex CLI', pid: 100 })).toBe(
      'Codex CLI started with root pid 100',
    );
    expect(safeTemplate('state_changed', { from: 'running', to: 'stopped' })).toBe(
      'State changed from running to stopped',
    );
    expect(safeTemplate('workspace_approved')).toBe('Workspace approved');
    expect(SUMMARY_TEMPLATE_IDS).toContain('reconciled');
  });

  it('rejects unknown templates, keys, unsafe values, and missing values', () => {
    const reason = (fn: () => unknown) => {
      try {
        fn();
      } catch (error) {
        return (error as ThreadHelmError).details.reason;
      }
      return 'no-throw';
    };
    expect(reason(() => safeTemplate('nope' as never))).toBe('UNKNOWN_TEMPLATE');
    expect(reason(() => safeTemplate('launched', { provider: 'x', pid: 1, prompt: 'hi' }))).toBe(
      'UNSAFE_TEMPLATE_VALUE',
    );
    expect(reason(() => safeTemplate('launched', { provider: 'x\x1b[0m', pid: 1 }))).toBe(
      'UNSAFE_TEMPLATE_VALUE',
    );
    expect(reason(() => safeTemplate('launched', { provider: 'x' }))).toBe(
      'MISSING_TEMPLATE_VALUE',
    );
  });
});
