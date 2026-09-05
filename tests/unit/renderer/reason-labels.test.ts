import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  REASON_LABELS,
  reasonLabel,
} from '../../../apps/desktop/src/renderer/features/mission-focus/reason-labels.js';

const roots = [
  'apps/desktop/src/main',
  'packages/domain/src',
  'packages/persistence/src',
  'packages/providers/src',
];
const prefixes = /'((?:WORKER|MISSION|SUPERVISOR|STARTUP|PERMISSION)_[A-Z0-9_]+)'/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (path.endsWith('.ts') && !path.endsWith('.test.ts')) out.push(path);
  }
  return out;
}

function emittedCodes(): string[] {
  const codes = new Set<string>();
  for (const root of roots)
    for (const file of walk(root))
      for (const match of readFileSync(file, 'utf8').matchAll(prefixes)) codes.add(match[1]!);
  return [...codes].sort();
}

describe('reason labels', () => {
  it('covers every mission-path reason code the main process can emit', () => {
    const codes = emittedCodes();
    expect(codes.length).toBeGreaterThan(20);
    const missing = codes.filter((code) => !(code in REASON_LABELS));
    expect(missing, 'add a human sentence for each').toEqual([]);
  });

  it('never returns a raw code', () => {
    for (const code of Object.keys(REASON_LABELS))
      expect(reasonLabel(code)).not.toMatch(/^[A-Z][A-Z0-9_]{2,63}$/);
    expect(reasonLabel('SOMETHING_NEW_HAPPENED')).toBe('Something new happened.');
    expect(reasonLabel(null)).toBeNull();
    expect(reasonLabel(undefined)).toBeNull();
  });

  it('labels every mission draft code as a sentence', () => {
    for (const code of [
      'MISSION_DRAFT_NOT_FOUND',
      'MISSION_DRAFT_STALE',
      'MISSION_DRAFT_LIMIT',
      'MISSION_DRAFT_SAVE_FAILED',
      'MISSION_DRAFT_DISCARD_STALE',
      'MISSION_CONFIRMATION_EXPIRED',
    ]) {
      expect(REASON_LABELS[code]).toMatch(/^[A-Z].*\.$/);
      expect(REASON_LABELS[code]).not.toMatch(/[A-Z]{3,}_/);
    }
  });

  it('labels the repo-idea codes as a sentence', () => {
    for (const code of ['REPO_IDEAS_UNAVAILABLE', 'REPO_IDEAS_OUTPUT_INVALID']) {
      expect(REASON_LABELS[code]).toMatch(/^[A-Z].*\.$/);
      expect(REASON_LABELS[code]).not.toMatch(/[A-Z]{3,}_/);
    }
  });
});
