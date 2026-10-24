import { describe, expect, it } from 'vitest';
import { cannibalizationIndex, findCannibalization, overlapsWith } from '@/services/topicalAuthority/cannibal';
import { authorityContext, authorityCoverage, authorityPage } from './authorityDirectFixtures';

const angled = (url: string, degrees: number, intent = 'topic', trs = 80) => authorityPage(url, {
  vector: new Map([['x', Math.cos(degrees * Math.PI / 180)], ['y', Math.sin(degrees * Math.PI / 180)]]),
  h1: new Set([intent]), focus: { ...authorityPage(url).focus, trs },
});

describe('direct cannibalization branches', () => {
  it('rejects full-subtopic pairs below the similarity threshold and ignores missing or excluded members', () => {
    const left = angled('/left', 0);
    const right = angled('/right', 90);
    const excluded = angled('/excluded', 0);
    const pages = [left, right];
    const row = authorityCoverage({ urls: [left.url, right.url, excluded.url, '/missing'] });
    expect(findCannibalization(pages, authorityContext(pages, [excluded]), [row], new Map())).toEqual([]);
  });

  it('keeps transitive evidence honest when the canonical has no direct edge to another member', () => {
    const pages = [angled('/a', 0, 'topic', 100), angled('/b', 20), angled('/c', 40)];
    const [group] = findCannibalization(pages, authorityContext(pages), [], new Map());
    expect(group).toMatchObject({ canonical: '/a', urls: ['/a', '/b', '/c'], similarity: 94, sharedEntitiesPct: 100 });
    expect(group.edges.map(({ from, to }) => [from, to])).toEqual([['/a', '/b'], ['/b', '/c']]);
    expect(group).not.toHaveProperty('subtopicId');
  });

  it.each([false, true])('sorts equal-size equal-similarity groups and their evidence deterministically (reverse=%s)', (reverse) => {
    const pages = [angled('/a/1', 0, 'alpha'), angled('/a/2', 0, 'alpha'), angled('/a/3', 0, 'alpha'),
      angled('/b/1', 0, 'beta'), angled('/b/2', 0, 'beta'), angled('/b/3', 0, 'beta')];
    if (reverse) pages.reverse();
    const groups = findCannibalization(pages, authorityContext(pages), [], new Map());
    expect(groups.map((group) => group.canonical)).toEqual(['/a/1', '/b/1']);
    expect(groups.map((group) => group.edges.map(({ from, to }) => `${from}|${to}`))).toEqual([
      ['/a/1|/a/2', '/a/1|/a/3', '/a/2|/a/3'], ['/b/1|/b/2', '/b/1|/b/3', '/b/2|/b/3'],
    ]);
  });

  it('orders groups first by population and then by similarity', () => {
    const pages = [angled('/large/1', 0, 'large'), angled('/large/2', 10, 'large'), angled('/large/3', 20, 'large'),
      angled('/less/1', 0, 'less'), angled('/less/2', 20, 'less'),
      angled('/more/1', 0, 'more'), angled('/more/2', 0, 'more')];
    const groups = findCannibalization(pages, authorityContext(pages), [], new Map());
    expect(groups.map((group) => group.urls[0])).toEqual(['/large/1', '/more/1', '/less/1']);
    expect(cannibalizationIndex(groups, pages.length)).toBe(57.1);
    expect(cannibalizationIndex(groups, 1)).toBe(100);
    expect(cannibalizationIndex([], 0)).toBe(0);
  });

  it.each([false, true])('sorts tied draft overlaps by URL and excludes the draft itself (reverse=%s)', (reverse) => {
    const draft = angled('/draft', 0);
    const pages = [draft, angled('/a', 0), angled('/b', 0), angled('/lower', 20), angled('/unrelated', 90)];
    if (reverse) pages.reverse();
    expect(overlapsWith(draft, pages)).toEqual([
      { url: '/a', similarity: 100 }, { url: '/b', similarity: 100 }, { url: '/lower', similarity: 94 },
    ]);
  });
});
