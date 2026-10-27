import { describe, expect, it } from 'vitest';
import { assertTrendingPayload, MAX_TRENDING_PAYLOAD_BYTES } from '@/services/trendingNow/contracts';

describe('assertTrendingPayload direct contract', () => {
  it('accepts an empty payload and the exact byte limit', () => {
    expect(() => assertTrendingPayload('')).not.toThrow();
    const exact = 'a'.repeat(MAX_TRENDING_PAYLOAD_BYTES);
    expect(new TextEncoder().encode(exact).byteLength).toBe(MAX_TRENDING_PAYLOAD_BYTES);
    expect(() => assertTrendingPayload(exact)).not.toThrow();
  });

  it('rejects a UTF-8 multibyte payload after the byte limit', () => {
    const unit = '🙂';
    const oversized = unit.repeat(Math.floor(MAX_TRENDING_PAYLOAD_BYTES / new TextEncoder().encode(unit).byteLength) + 1);
    expect(new TextEncoder().encode(oversized).byteLength).toBeGreaterThan(MAX_TRENDING_PAYLOAD_BYTES);
    expect(() => assertTrendingPayload(oversized)).toThrow(/byte limit/);
  });
});
