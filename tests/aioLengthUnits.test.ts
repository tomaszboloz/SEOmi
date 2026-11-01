import { describe, expect, it } from 'vitest';
import { AIO_LENGTH_UNIT, estimateModelTokens } from '@/services/aioReadiness/units';
import { extractabilityDetails } from '@/services/aioReadiness/extractability';
import { buildAioReport } from '@/services/aioReadiness/report';

describe('AIO length unit and extractability decisions (GEM-63-D01/D02)', () => {
  it('counts words and only estimates model tokens', () => {
    expect(AIO_LENGTH_UNIT).toBe('words');
    expect(estimateModelTokens('one two three four')).toBe(6);
    expect(estimateModelTokens('犬が走るのは速い', true)).toBe(6);
    expect(estimateModelTokens('')).toBe(0);
  });
  it('keeps extractability in 0..1 and empty pages at 0', () => {
    const empty = extractabilityDetails([]);
    expect(empty.score).toBe(0);
    expect(empty.normalization).toHaveLength(3);
  });
  it('aggregates the domain as the mean of scored pages and skips empty ones', () => {
    expect(buildAioReport([]).extractability).toBe(0);
  });
});
