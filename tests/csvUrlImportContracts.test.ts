import { expect, it } from 'vitest';
import { importUrlsFromCsv } from '@/services/csvUrls';

it('handles empty rows and headers with no data', () => {
  expect(importUrlsFromCsv('\r\n , \n')).toEqual({ urls: [], rejected: [] });
  expect(importUrlsFromCsv('URL')).toEqual({ urls: [], rejected: [] });
});

it('uses the URL column and records short or invalid rows', () => {
  expect(importUrlsFromCsv('name,Website URL\r\nFirst,https://EXAMPLE.test/a#one\r\nSecond,https://example.test/a#two\r\nMissing\r\nBad,file:///tmp/a')).toEqual({
    urls: ['https://example.test/a'], rejected: ['Missing', 'Bad, file:///tmp/a'],
  });
});

it('accepts all valid cells in a headerless file and preserves query strings', () => {
  expect(importUrlsFromCsv('https://one.test,https://two.test?q=1\rhttps://two.test?q=2\nnot a url')).toEqual({
    urls: ['https://one.test/', 'https://two.test/?q=1', 'https://two.test/?q=2'], rejected: ['not a url'],
  });
});

it('handles quoted commas, escaped quotes and multiline cells', () => {
  expect(importUrlsFromCsv('name,url\n"a,""quoted""\nlabel",https://example.test\n"bad, name",invalid')).toEqual({ urls: ['https://example.test/'], rejected: ['bad, name, invalid'] });
});
