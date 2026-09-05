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
