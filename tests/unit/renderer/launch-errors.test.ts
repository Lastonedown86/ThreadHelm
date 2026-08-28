import { describe, expect, it } from 'vitest';
import { ErrorCode } from '@threadhelm/contracts';
import { ERROR_MESSAGES } from '../../../apps/desktop/src/renderer/features/launch/LaunchErrors.js';

describe('launch error messages', () => {
  it('has an actionable sentence for every contract error code', () => {
    for (const code of ErrorCode.options) {
      expect(ERROR_MESSAGES[code].length, code).toBeGreaterThan(10);
    }
    expect(Object.keys(ERROR_MESSAGES).sort()).toEqual([...ErrorCode.options].sort());
  });

  it('directs the one-writer conflict to a separate folder or worktree', () => {
    expect(ERROR_MESSAGES.WRITE_LEASE_HELD).toMatch(/separate folder or worktree/);
  });
});
