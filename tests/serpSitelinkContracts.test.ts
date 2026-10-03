import { expect, it } from 'vitest';
import { deriveSerpSitelinks, formatSerpDisplayUrl } from '@/services/serpPreview/sitelinks';
it('keeps malformed path encodings visible and removes query and fragment from display', () => {
  expect(formatSerpDisplayUrl('https://site.test/%ZZ/path?q=1#top')).toBe('site.test › %ZZ › path');
  expect(formatSerpDisplayUrl('https://site.test/')).toBe('site.test');
  expect(formatSerpDisplayUrl('invalid')).toBe('invalid');
});
it('rejects invalid pages, malformed targets, cross-origin links and empty labels', () => {
  expect(deriveSerpSitelinks([], 'invalid')).toEqual([]);
  expect(deriveSerpSitelinks([
    { href: '/valid', text: '  ', is_internal: true },
    { href: 'https://other.test/', text: 'Other', is_internal: true },
    { href: '/external', text: 'External flag', is_internal: false },
    { href: 'http://[', text: 'Malformed', is_internal: true },
  ], 'https://site.test/')).toEqual([]);
});
it('bounds candidate count and labels, deduplicates fragments and preserves query identities', () => {
  const links = Array.from({ length: 20 }, (_, index) => ({ href: `/page?id=${index}`, text: 'a'.repeat(100), is_internal: true }));
  const result = deriveSerpSitelinks(links, 'https://site.test/', 100);
  expect(result).toHaveLength(12); expect(result[0].label).toHaveLength(80);
  expect(result[0].url).toBe('https://site.test/page?id=0');
  expect(result[1].url).toBe('https://site.test/page?id=1');
  expect(deriveSerpSitelinks(links, 'https://site.test/')).toHaveLength(6);
  expect(deriveSerpSitelinks(links, 'https://site.test/', -1)).toEqual([]);
  expect(links).toHaveLength(20);
});
