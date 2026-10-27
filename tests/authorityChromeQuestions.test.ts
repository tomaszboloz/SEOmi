import { describe, expect, it } from 'vitest';
import { buildContext } from '@/services/topicalAuthority';
import { countOrigins, isChromeOrigin, linkOrigin } from '@/services/topicalAuthority/chrome';
import { resolveQuestions } from '@/services/topicalAuthority/questions';
import { contentEdges } from '@/services/topicalAuthority/silo';
import { COFFEE, OWN_HOST, coffeePage, ownReport } from './authorityFixtures';

const START = `https://${OWN_HOST}/`;

describe('link zone origin', () => {
  it('maps crawler zones and counts them', () => {
    expect(['nav_breadcrumb', 'sidebar_footer', 'main', 'widget', null, undefined, 'x'].map(linkOrigin)).toEqual(['menu', 'sidebar_footer', 'content', 'content', 'unknown', 'unknown', 'unknown']);
    expect(isChromeOrigin('menu') && isChromeOrigin('sidebar_footer')).toBe(true);
    expect(isChromeOrigin('content') || isChromeOrigin('unknown')).toBe(false);
    expect(countOrigins(['nav_breadcrumb', 'sidebar_footer', 'main', null, 'main'])).toEqual({ menu: 1, sidebarFooter: 1, content: 2, unknown: 1 });
  });
});

describe('contentEdges with zone data', () => {
  const pages = (zone: string | undefined) => {
    const make = (path: string, links: Array<[string, string]>) => coffeePage(OWN_HOST, { path, title: path, terms: COFFEE, links });
    const list = [make('/', [['/a', 'a page']]), make('/a', [['/', 'home']]), make('/b', [])];
    if (zone) list[0].links = list[0].links.map((link) => ({ ...link, zone, zone_method: 'dom-ancestry' }));
    return list;
  };
  const edges = (zone: string | undefined) => {
    const list = pages(zone);
    return contentEdges(buildContext(list, START, ownReport(list)));
  };

  it('drops menu and sidebar/footer links even on a small site where the share heuristic cannot fire', () => {
    expect(edges(undefined).some((edge) => edge.to.endsWith('/a'))).toBe(true);
    expect(edges('nav_breadcrumb').some((edge) => edge.to.endsWith('/a'))).toBe(false);
    expect(edges('sidebar_footer').some((edge) => edge.to.endsWith('/a'))).toBe(false);
  });

  it('keeps links the crawler placed in main content', () => {
    expect(edges('main').some((edge) => edge.to.endsWith('/a'))).toBe(true);
  });
});

describe('resolveQuestions', () => {
  it('never turns suggestions or headings into PAA', () => {
    const result = resolveQuestions({ suggestions: ['how to brew?', 'espresso'], headings: ['What is a grinder?', 'Brewing'] });
    expect(result.paa).toEqual([]);
    expect(result.paaAvailable).toBe(false);
    expect(result.related).toEqual([{ source: 'google-suggest', question: 'how to brew?' }, { source: 'competitor-headings', question: 'What is a grinder?' }]);
  });

  it('keeps real PAA first and deduplicates across sources', () => {
    const result = resolveQuestions({ paa: [' Is it safe? ', 'Is it safe?', ''], suggestions: ['is it safe?', 'Why？'], headings: ['Why？'] });
    expect(result.paa).toEqual(['Is it safe?']);
    expect(result.paaAvailable).toBe(true);
    expect(result.related).toEqual([{ source: 'google-suggest', question: 'Why？' }]);
  });

  it('is empty without any input', () => {
    expect(resolveQuestions({})).toEqual({ paa: [], paaAvailable: false, related: [] });
  });
});
