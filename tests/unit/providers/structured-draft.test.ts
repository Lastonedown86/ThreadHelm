import { describe, expect, it } from 'vitest';
import { codexAdapter, claudeCodeAdapter } from '@threadhelm/providers';

const PROMPT = 'List three ideas.\nSecond line with "quotes" & 100% symbols.';

describe('structured-draft capability surface', () => {
  it('codex declares the capability and builds a non-interactive descriptor', () => {
    expect(codexAdapter.capabilities.structuredDraft).toBe(true);
    const descriptor = codexAdapter.buildStructuredDraft!({
      prompt: PROMPT,
      resolvedExecutable: 'C:\\codex\\codex.exe',
      executableKind: 'native',
    });
    expect(descriptor.executable).toBe('C:\\codex\\codex.exe');
    expect(descriptor.args).toEqual([
      'exec',
      '--json',
      '--skip-git-repo-check',
      '--sandbox',
      'read-only',
    ]);
    // The prompt travels on stdin: it can hold newlines, quotes and README
    // text without meeting argv length limits or cmd.exe quoting rules.
    expect(descriptor.stdin).toBe(PROMPT);
    expect(descriptor.args).not.toContain(PROMPT);
  });

  it('claude-code declares the capability and builds a non-interactive descriptor', () => {
    expect(claudeCodeAdapter.capabilities.structuredDraft).toBe(true);
    const descriptor = claudeCodeAdapter.buildStructuredDraft!({
      prompt: PROMPT,
      resolvedExecutable: 'C:\\claude\\claude.exe',
      executableKind: 'native',
    });
    expect(descriptor.executable).toBe('C:\\claude\\claude.exe');
    expect(descriptor.args).toEqual([
      '-p',
      '--output-format',
      'json',
      '--tools',
      '',
      '--strict-mcp-config',
    ]);
    expect(descriptor.stdin).toBe(PROMPT);
  });

  it('passes an explicit model and effort through as fixed tokens', () => {
    const codex = codexAdapter.buildStructuredDraft!({
      prompt: PROMPT,
      resolvedExecutable: 'C:\\codex\\codex.exe',
      executableKind: 'native',
      model: 'gpt-5-codex',
      effort: 'high',
    });
    expect(codex.args).toEqual(
      expect.arrayContaining(['--model', 'gpt-5-codex', '--config', 'model_reasoning_effort=high']),
    );
    const claude = claudeCodeAdapter.buildStructuredDraft!({
      prompt: PROMPT,
      resolvedExecutable: 'C:\\claude\\claude.exe',
      executableKind: 'native',
      model: 'sonnet',
      effort: 'low',
    });
    expect(claude.args).toEqual(expect.arrayContaining(['--model', 'sonnet', '--effort', 'low']));
  });

  it('routes a cmd shim through cmd.exe with only fixed tokens on argv', () => {
    const descriptor = codexAdapter.buildStructuredDraft!({
      prompt: PROMPT,
      resolvedExecutable: 'C:\\Users\\Ana María\\AppData\\Roaming\\npm\\codex.cmd',
      executableKind: 'cmd_shim',
    });
    expect(descriptor.executable).toBe('C:\\Windows\\System32\\cmd.exe');
    expect(descriptor.args.join(' ')).not.toContain('List three ideas');
    expect(descriptor.stdin).toBe(PROMPT);
  });
});

describe('codex structured-draft output parsing', () => {
  // Fixture shape verified against codex-cli 0.150.1 `exec --json`.
  it('extracts the final agent text from a JSONL stream', () => {
    const jsonl = [
      JSON.stringify({ type: 'thread.started', thread_id: 't1' }),
      JSON.stringify({ type: 'turn.started' }),
      JSON.stringify({
        type: 'item.completed',
        item: { id: 'item_0', type: 'agent_message', text: '{"ideas":[]}' },
      }),
      JSON.stringify({ type: 'turn.completed' }),
    ].join('\n');
    const text = codexAdapter.parseStructuredDraftOutput!({
      stdout: jsonl,
      stderr: '',
      exitCode: 0,
    });
    expect(text).toBe('{"ideas":[]}');
  });

  it('returns null when no agent_message item is present', () => {
    const jsonl = [
      JSON.stringify({
        type: 'item.completed',
        item: { id: 'item_0', type: 'error', message: 'model not found' },
      }),
      JSON.stringify({ type: 'turn.failed', error: { message: 'boom' } }),
    ].join('\n');
    expect(
      codexAdapter.parseStructuredDraftOutput!({ stdout: jsonl, stderr: '', exitCode: 1 }),
    ).toBeNull();
  });

  it('returns null on malformed JSONL rather than throwing', () => {
    expect(
      codexAdapter.parseStructuredDraftOutput!({
        stdout: 'not json\n{also not json',
        stderr: '',
        exitCode: 0,
      }),
    ).toBeNull();
  });
});

describe('claude-code structured-draft output parsing', () => {
  // Envelope shape verified against Claude Code 2.1.260 `-p --output-format json`.
  it('extracts the result field from the JSON envelope', () => {
    const envelope = JSON.stringify({
      type: 'result',
      subtype: 'success',
      result: '{"ideas":[]}',
      session_id: 's1',
      is_error: false,
    });
    const text = claudeCodeAdapter.parseStructuredDraftOutput!({
      stdout: envelope,
      stderr: '',
      exitCode: 0,
    });
    expect(text).toBe('{"ideas":[]}');
  });

  it('returns null when is_error is true', () => {
    const envelope = JSON.stringify({ result: 'ignored', is_error: true });
    expect(
      claudeCodeAdapter.parseStructuredDraftOutput!({
        stdout: envelope,
        stderr: '',
        exitCode: 0,
      }),
    ).toBeNull();
  });

  it('returns null on malformed JSON rather than throwing', () => {
    expect(
      claudeCodeAdapter.parseStructuredDraftOutput!({
        stdout: 'not json',
        stderr: '',
        exitCode: 0,
      }),
    ).toBeNull();
  });
});
