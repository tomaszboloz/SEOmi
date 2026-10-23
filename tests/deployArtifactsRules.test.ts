import { describe, expect, it } from 'vitest';
import { validateRules } from '@/services/deployArtifacts/rules';
import { buildDeploymentBundle, bundleToZip } from '@/services/deployArtifacts/bundle';
import { buildZip, crc32 } from '@/services/deployArtifacts/zip';
import { buildMergingBlueprint, pickWinner } from '@/services/deployArtifacts/blueprint';
import { createCrawlPageFixture as page } from './fixtures/crawl';

const r = (from: string, to: string | null, status: 301 | 410 = 301) => ({ from: `https://a.test/${from}`, to: to === null ? null : `https://a.test/${to}`, status });

describe('validateRules', () => {
  it('rejects invalid, duplicate and self-loop rules', () => {
    const { rules, issues } = validateRules([r('a', 'b'), r('a', 'c'), r('s', 's'), { from: 'x', to: 'https://a.test/y', status: 301 }, { from: 'ftp://a.test/f', to: 'https://a.test/y', status: 301 }, { from: 'https://a.test/z', to: null, status: 301 }, { from: 'https://a.test/q', to: null, status: 302 as 301 }]);
    expect(rules.map((x) => x.from)).toEqual(['https://a.test/a']);
    expect(issues.map((i) => i.kind)).toEqual(['duplicate', 'loop', 'invalid', 'invalid', 'invalid', 'invalid']);
  });

  it('flattens chains so there are no redirect hops', () => {
    const { rules, issues } = validateRules([r('a', 'b'), r('b', 'c'), r('c', 'd')]);
    expect(rules.map((x) => x.to)).toEqual(['https://a.test/d', 'https://a.test/d', 'https://a.test/d']);
    expect(issues.filter((i) => i.kind === 'chain-flattened')).toHaveLength(2);
  });

  it('drops two-node and longer loops', () => {
    const { rules, issues } = validateRules([r('a', 'b'), r('b', 'a'), r('c', 'a'), r('k', 'l')]);
    expect(rules.map((x) => x.from)).toEqual(['https://a.test/k']);
    expect(issues.filter((i) => i.kind === 'loop').map((i) => i.from).sort()).toEqual(['https://a.test/a', 'https://a.test/b', 'https://a.test/c']);
  });

  it('flags a 301 that ends on a 410 page and keeps 410 rules', () => {
    const { rules, issues } = validateRules([r('a', 'b'), r('b', null, 410)]);
    expect(rules).toHaveLength(2);
    expect(issues).toEqual([{ kind: 'dead-target', from: 'https://a.test/a' }]);
  });
});

describe('bundle and zip', () => {
  it('builds every format and a valid zip', () => {
    const bundle = buildDeploymentBundle([r('a', 'b'), r('g', null, 410), r('q?x=1', 'b')]);
    expect(bundle.files.map((f) => f.name)).toEqual(['.htaccess', 'nginx-redirects.conf', 'cloudflare-bulk-redirects.csv', 'wp-redirection.csv', 'wp-redirection.json']);
    expect(bundle.ruleCount).toBe(3);
    expect(bundle.issues.map((i) => i.kind).sort()).toEqual(['gone-unsupported', 'query-unsupported', 'query-unsupported']);
    const zip = bundleToZip(bundle);
    expect(new DataView(zip.buffer).getUint32(0, true)).toBe(0x04034b50);
    expect(new DataView(zip.buffer).getUint16(zip.length - 14, true)).toBe(5);
  });

  it('crc32 matches the reference value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(buildZip([]).length).toBe(22);
  });
});

describe('merging blueprint', () => {
  const c = (url: string, trs: number | null, depth: number, inlinks: number, clicks: number | null) => ({ url, trs, depth, inlinks, clicks });

  it('picks the winner by TRS, depth, links and GSC and is stable on ties', () => {
    expect(pickWinner([c('https://a.test/b', 60, 3, 2, 10), c('https://a.test/a', 80, 1, 9, 100)])).toBe('https://a.test/a');
    expect(pickWinner([c('https://a.test/b', null, 0, 0, null), c('https://a.test/a', null, 0, 0, null)])).toBe('https://a.test/a');
  });

  it('plans H2 moves, linkers to update and chain-free rules', () => {
    const a = page({ url: 'https://a.test/a', final_url: 'https://a.test/a', heading_texts: { h1: [], h2: ['Intro'], h3: [] } });
    const b = page({ url: 'https://a.test/b', final_url: 'https://a.test/b', heading_texts: { h1: [], h2: ['intro', 'Pricing'], h3: [] } });
    const linker = page({ url: 'https://a.test/l', final_url: 'https://a.test/l', links: [{ target_url: 'https://a.test/b#x', anchor_text: 'b', is_internal: true }] });
    const plan = buildMergingBlueprint([c('https://a.test/a', 90, 1, 5, 50), c('https://a.test/b', 40, 2, 1, 5)], [a, b, linker])!;
    expect(plan.winner).toBe('https://a.test/a');
    expect(plan.merges).toEqual([{ url: 'https://a.test/b', h2ToMove: ['Pricing'], linkersToUpdate: ['https://a.test/l'] }]);
    expect(plan.rules).toEqual([{ from: 'https://a.test/b', to: 'https://a.test/a', status: 301 }]);
    expect(buildMergingBlueprint([c('https://a.test/a', 1, 1, 1, 1)], [])).toBeNull();
    const noFinal = page({ url: 'https://a.test/b', final_url: '', heading_texts: { h1: [], h2: ['Only'], h3: [] } });
    expect(buildMergingBlueprint([c('https://a.test/a', 9, 1, 1, 1), c('https://a.test/b', 1, 1, 1, 1)], [noFinal])!.merges[0].h2ToMove).toEqual(['Only']);
    expect(buildMergingBlueprint([c('https://a.test/a', 1, 1, 1, 1), c('https://a.test/z', 1, 1, 1, 1)], [])!.merges[0].h2ToMove).toEqual([]);
  });
});
