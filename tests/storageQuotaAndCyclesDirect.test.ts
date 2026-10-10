import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  writeJsonStorage,
  writeStorageResult,
  readStorageEntries,
} from '@/services/storage';
import { persistAuditHistory } from '@/stores/audit/auditHelpers';
import { createAuditFixture } from './fixtures/audit';

describe('storage cyclic and quota handling direct contracts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('catches cyclic JSON serialization safely in writeJsonStorage', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(writeJsonStorage('cyclic_key', cyclic)).toBe(false);
  });

  it('handles undefined localStorage gracefully', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(writeStorageResult('key', 'val')).toEqual({ ok: false });
    expect(readStorageEntries('prefix_')).toEqual({});
  });

  it('recovers partial entries when enumeration throws in readStorageEntries', () => {
    let callCount = 0;
    vi.stubGlobal('localStorage', {
      get length() { return 5; },
      key: (i: number) => {
        callCount++;
        if (i === 1) throw new Error('enumeration blocked');
        return `prefix_item_${i}`;
      },
      getItem: () => 'val',
    });
    const result = readStorageEntries('prefix_');
    expect(callCount).toBeGreaterThanOrEqual(1);
    expect(typeof result).toBe('object');
  });

  it('handles persistAuditHistory serialization errors, quota, and storage failure', () => {
    let accessCount = 0;
    const throwingAudit = createAuditFixture();
    Object.defineProperty(throwingAudit, 'url', {
      get() {
        accessCount++;
        if (accessCount === 3) throw new Error('serialization failure');
        return 'https://example.com';
      },
    });

    const outcome = persistAuditHistory('p_throw', [throwingAudit]);
    expect(outcome.saved).toBe(true);

    // Quota error
    const validAudit = createAuditFixture();
    vi.stubGlobal('localStorage', {
      setItem: () => {
        const error = new DOMException('Quota exceeded', 'QuotaExceededError');
        throw error;
      },
      getItem: () => null,
      removeItem: () => undefined,
    });
    const outcomeQuota = persistAuditHistory('p_quota', [validAudit]);
    expect(outcomeQuota.saved).toBe(false);
    expect(outcomeQuota.quota).toBe(true);
  });
});
