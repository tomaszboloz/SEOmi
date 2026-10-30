import { describe, expect, it } from 'vitest';
import { checkDraftOverlap } from '@/services/topicalAuthority';
import type { FocusPage } from '@/services/siteFocus';

const HOST = 'coffee.test';
const START = `https://${HOST}/`;
const u = (path: string) => `https://${HOST}${path}`;
const BODY = 'espresso machine pressure portafilter grinder crema extraction boiler pump tamper';
const page = (path: string, title: string, body: string, canonical?: string) => ({
  url: u(path), final_url: u(path), title, semantic_excerpts: [body], links: [], http_status: 200, content_type: 'text/html',
  ...(canonical ? { canonical } : {}),
}) as unknown as FocusPage;
const site = (canonical?: string) => [
  page('/espresso/machines', 'Espresso machines', BODY),
  page('/espresso/machine-review', 'Espresso machines', BODY, canonical),
  page('/tea/green', 'Green tea', 'green tea leaves steeping temperature matcha sencha gyokuro kettle cup'),
];
const draft = { title: 'Espresso machines', body: BODY };

describe('pre-publish check for an update of an existing page (GEM-59-07)', () => {
  it('excludes the page being updated and its canonical aliases, without touching the crawl', () => {
    const pages = site();
    const before = JSON.stringify(pages);
    const all = checkDraftOverlap(draft, pages, START, 'en').map((hit) => hit.url);
    expect(all).toEqual(expect.arrayContaining([u('/espresso/machines'), u('/espresso/machine-review')]));
    const self = checkDraftOverlap(draft, pages, START, 'en', `${u('/espresso/machines')}/`).map((hit) => hit.url);
    expect(self).not.toContain(u('/espresso/machines'));
    expect(self).toContain(u('/espresso/machine-review'));
    const aliased = checkDraftOverlap(draft, site(u('/espresso/machines')), START, 'en', u('/espresso/machine-review')).map((hit) => hit.url);
    expect(aliased).toEqual([]);
    expect(checkDraftOverlap(draft, pages, START, 'en', '   ')).toEqual(checkDraftOverlap(draft, pages, START, 'en'));
    expect(JSON.stringify(pages)).toBe(before);
  });
});
