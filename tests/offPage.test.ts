import { describe, expect, it } from 'vitest';
import { normalize } from '@/services/embeddings/vector';
import { findCoCitations } from '@/services/offPage/cocitation';
import { computeTbva, type OffPageLink } from '@/services/offPage/tbva';

const v = (...x: number[]) => normalize(x);
const link = (url: string, authority: number | null, over: Partial<OffPageLink> = {}): OffPageLink => ({ sourceUrl: url, authority, follow: true, vector: v(1, 0), ...over });

describe('tbva', () => {
  it('is unavailable without topic, scale or follow links', () => {
    expect(computeTbva([link('https://a.test/', 50)], { scale: 100, topic: null }).limitations).toEqual(['no-topic-vector']);
    expect(computeTbva([link('https://a.test/', 50)], { scale: 0, topic: v(1, 0) }).limitations).toEqual(['invalid-scale']);
    expect(computeTbva([], { scale: 100, topic: v(1, 0) }).limitations).toEqual(['no-follow-links']);
    const none = computeTbva([link('https://a.test/', null), link('https://b.test/', 10, { vector: null })], { scale: 100, topic: v(1, 0) });
    expect(none).toMatchObject({ status: 'unavailable', coverage: 0, unscored: 2, tbva: null });
  });
  it('computes a hand-checked sum', () => {
    const r = computeTbva([link('https://a.test/x', 50), link('https://b.test/', 100, { vector: v(1, 1) }), link('https://c.test/', 80, { vector: v(0, 1) })], { scale: 100, topic: v(1, 0) });
    expect(r.status).toBe('ready');
    expect(r.tbva).toBeCloseTo(0.5 + Math.SQRT1_2, 3);
    expect(r.counted).toBe(3);
    expect(r.coverage).toBe(1);
  });
  it('dedupes sitewide domains, skips nofollow and handles scale and dimension problems', () => {
    const r = computeTbva([
      link('https://www.a.test/1', 20), link('https://a.test/2', 90), link('not a url', 100, { follow: false }),
      link('https://d.test/', 500), link('https://e.test/', 50, { vector: v(1, 0, 0) }),
    ], { scale: 100, topic: v(1, 0) });
    expect(r).toMatchObject({ status: 'partial', counted: 2, duplicateDomains: 1, nofollow: 1, unscored: 1 });
    expect(r.tbva).toBeCloseTo(0.9 + 1, 3);
    expect(r.coverage).toBeCloseTo(3 / 4);
    expect(computeTbva([link('bad url', 10)], { scale: 100, topic: v(1, 0) }).counted).toBe(1);
  });
  it('clamps negative authority and negative cosine to zero', () => {
    const r = computeTbva([link('https://a.test/', -5), link('https://b.test/', 50, { vector: v(-1, 0) })], { scale: 100, topic: v(1, 0) });
    expect(r.tbva).toBe(0);
  });
});

describe('co-citation', () => {
  const p = (text: string, linked = false, offset = 0) => ({ sourceUrl: 'https://s.test/', offset, text, linked });
  it('reports an empty state without source text', () => {
    expect(findCoCitations([], ['Acme'], 'seo').note).toBe('no-source-text');
    expect(findCoCitations([p('Acme seo')], [' '], 'seo').linked).toEqual([]);
    expect(findCoCitations([p('Acme seo')], ['Acme'], ' ').unlinked).toEqual([]);
  });
  it('requires both terms in one paragraph and separates linked from unlinked', () => {
    const r = findCoCitations([p('Acme is a leading SEO tool.', true), p('We like seo. Acme too?', false, 40), p('Acmegroup does seo'), p('only seo here'), p('Acme without topic')], ['Acme', 'ACME Inc'], 'SEO');
    expect(r.linked).toHaveLength(1);
    expect(r.unlinked).toHaveLength(1);
    expect(r.unlinked[0].offset).toBe(40);
    expect(r.inspected).toBe(5);
    expect(r.linked[0].polarity).toBe('neutral');
  });
  it('marks negated mentions as unclear and escapes regex characters', () => {
    const r = findCoCitations([p('Acme is not good at seo'), p('C++ (beta) for seo')], ['Acme', 'C++ (beta)'], 'seo');
    expect(r.unlinked.map((c) => c.polarity)).toEqual(['unclear', 'neutral']);
  });
});
