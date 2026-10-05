import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { buildOpenGraphChecks, buildTwitterCardChecks } from '@/services/auditChecks/socialAndHeadingsChecks';
import type { PageAuditData } from '@/types';

const goodOg = { og_title: 'T', og_description: 'd', og_image: 'https://a.test/i.png', og_image_width: '1200', og_image_height: '630', og_url: 'https://a.test/', og_type: 'website', og_site_name: 'S', og_locale: 'en', all_tags: [{ property: 'og:title' }, { property: 'og:url' }] };
const goodTw = { twitter_card: 'summary_large_image', twitter_title: 'T', twitter_description: 'd', twitter_image: 'https://a.test/i.png', twitter_site: '@s', twitter_creator: '@c', all_tags: [{ name: 'twitter:card' }, { name: 'twitter:title' }] };
const page = (og: Record<string, unknown>, tw: Record<string, unknown> = {}, title = 'T') => ({ url: 'https://a.test/', final_url: 'https://a.test/', meta_tags: { title }, open_graph: og, twitter_card: tw }) as unknown as PageAuditData;
const og = (audit: PageAuditData) => Object.fromEntries(buildOpenGraphChecks(audit).map((c) => [c.id, c.status]));
const tw = (audit: PageAuditData) => Object.fromEntries(buildTwitterCardChecks(audit).map((c) => [c.id, c.status]));

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('Open Graph checks', () => {
  it('passes a complete, aligned declaration', () => {
    expect(Object.values(og(page(goodOg))).every((s) => s === 'pass')).toBe(true);
  });

  it('warns on every missing required tag and skips dependent checks', () => {
    const s = og(page({}));
    for (const id of ['og-title', 'og-description', 'og-image', 'og-url', 'og-type']) expect(s[id]).toBe('warning');
    for (const id of ['og-image-absolute', 'og-image-dimensions', 'og-url-match', 'og-title-alignment', 'og-site-name', 'og-locale']) expect(s[id]).toBe('not_applicable');
    expect(s['og-tag-duplicates']).toBe('pass');
  });

  it('flags relative image, missing dimensions, foreign url and title mismatch', () => {
    const s = og(page({ ...goodOg, og_image: '/i.png', og_image_height: '', og_url: 'https://other.test/', og_title: 'Other' }));
    expect([s['og-image-absolute'], s['og-image-dimensions'], s['og-url-match'], s['og-title-alignment']]).toEqual(['warning', 'warning', 'warning', 'warning']);
  });

  it('detects duplicate tags by property or name and tolerates nameless tags', () => {
    expect(og(page({ ...goodOg, all_tags: [{ property: 'og:title' }, { property: 'og:title' }] }))['og-tag-duplicates']).toBe('warning');
    expect(og(page({ ...goodOg, all_tags: [{ name: 'a' }, { name: 'a' }] }))['og-tag-duplicates']).toBe('warning');
    expect(og(page({ ...goodOg, all_tags: [{}, {}] }))['og-tag-duplicates']).toBe('warning');
  });

  it('trims the page title before comparing and falls back to the request url', () => {
    expect(og(page(goodOg, {}, '  T  '))['og-title-alignment']).toBe('pass');
    const audit = { ...page(goodOg), final_url: '' } as PageAuditData;
    expect(og(audit)['og-url-match']).toBe('pass');
  });
});

describe('Twitter card checks', () => {
  it('passes a complete declaration', () => {
    expect(Object.values(tw(page({}, goodTw))).every((s) => s === 'pass')).toBe(true);
  });

  it('warns on missing core tags and marks optional ones not applicable', () => {
    const s = tw(page({}, {}));
    for (const id of ['twitter-card', 'twitter-title', 'twitter-description', 'twitter-image']) expect(s[id]).toBe('warning');
    for (const id of ['twitter-site', 'twitter-creator', 'twitter-image-absolute', 'twitter-card-supported', 'twitter-title-alignment']) expect(s[id]).toBe('not_applicable');
  });

  it.each([['summary', 'pass'], ['SUMMARY_LARGE_IMAGE', 'pass'], [' player ', 'pass'], ['app', 'pass'], ['gallery', 'warning']])('rates card type %s as %s', (card, expected) => {
    expect(tw(page({}, { ...goodTw, twitter_card: card }))['twitter-card-supported']).toBe(expected);
  });

  it('flags relative image, title mismatch and duplicate tags', () => {
    const s = tw(page({}, { ...goodTw, twitter_image: 'i.png', twitter_title: 'X', all_tags: [{ name: 'a' }, { property: 'a' }] }));
    expect([s['twitter-image-absolute'], s['twitter-title-alignment'], s['twitter-tags-duplicates']]).toEqual(['warning', 'warning', 'warning']);
  });
});
