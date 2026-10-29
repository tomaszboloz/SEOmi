import { describe, expect, it } from 'vitest';
import { formatGaps } from '@/services/sija/formatGaps';
import type { PageFeatures } from '@/services/sija/types';

const f = (over: Partial<PageFeatures> = {}): PageFeatures => ({ tables: 0, orderedLists: 0, unorderedLists: 0, formInputs: 0, calculators: 0, productCards: 0, localSignals: 0, words: 500, headings: 4, headingText: '', ...over });

describe('SIJA format gaps (#69 GEM-69-08/09)', () => {
  it('suggests formats most TOP pages use and the page lacks', () => {
    const top = [f({ tables: 1, orderedLists: 1 }), f({ tables: 2 }), f({ tables: 1, productCards: 3 })];
    expect(formatGaps(f(), top)).toEqual([{ format: 'table', topPages: 3, analysed: 3 }]);
    expect(formatGaps(f({ tables: 1 }), top)).toEqual([]);
  });
  it('needs at least 3 rendered pages and a real form control for calculators', () => {
    expect(formatGaps(f(), [f({ tables: 1 }), f({ tables: 1 })])).toEqual([]);
    const classOnly = [f({ calculators: 1 }), f({ calculators: 1 }), f({ calculators: 1 })];
    expect(formatGaps(f(), classOnly)).toEqual([]);
    const real = classOnly.map((page) => ({ ...page, formInputs: 2 }));
    expect(formatGaps(f(), real)).toEqual([{ format: 'calculator', topPages: 3, analysed: 3 }]);
  });
});
