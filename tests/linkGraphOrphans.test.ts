import { describe, expect, it } from 'vitest';
import { inboundSources, isOrphan, orphanNodes } from '@/services/linkGraph';

describe('linkGraph orphan rule (#106)', () => {
  it('counts distinct linking pages and ignores self-links and empty ends', () => {
    const inbound = inboundSources([
      { from: 'a', to: 'b' }, { from: 'a', to: 'b' }, { from: 'c', to: 'b' },
      { from: 'b', to: 'b' }, { from: '', to: 'c' }, { from: 'a', to: '' },
    ]);
    expect([...inbound.get('b')!].sort()).toEqual(['a', 'c']);
    expect(inbound.has('c')).toBe(false);
    expect(inbound.size).toBe(1);
  });

  it('roots are never orphans; pages with only a self-link are', () => {
    const inbound = inboundSources([{ from: 'x', to: 'x' }]);
    expect(isOrphan('x', inbound, new Set())).toBe(true);
    expect(isOrphan('x', inbound, new Set(['x']))).toBe(false);
  });

  it('returns sorted orphans and treats an empty edge set as all non-root pages orphaned', () => {
    expect(orphanNodes(['d', 'b', 'a', 'c'], [{ from: 'a', to: 'b' }], new Set(['a']))).toEqual(['c', 'd']);
    expect(orphanNodes(['b', 'a'], [])).toEqual(['a', 'b']);
    expect(orphanNodes([], [{ from: 'a', to: 'b' }])).toEqual([]);
  });
});
