import { describe, expect, it } from 'vitest';
import { diffLines, hasChanges } from '@/services/cmsPatch/diff';
import { patchSection } from '@/services/cmsPatch/patch';
import { assertSafeCmsUrl, cmsUrl } from '@/services/cmsPatch/ssrf';
import { sectionApplied } from '@/services/cmsPatch/verify';
import { CmsError } from '@/services/cmsPatch/types';

const html = '<h1>Title</h1>\n<p>intro</p>\n<h2>Pricing</h2>\n<p>old price</p>\n<h3>Sub</h3>\n<p>sub body</p>\n<h2>FAQ</h2>\n<p>faq</p>\n';

describe('patchSection', () => {
  it('replaces only the targeted section and keeps the rest byte for byte', () => {
    const out = patchSection(html, 'Pricing', '<p>new price</p>');
    expect(out.content).toBe('<h1>Title</h1>\n<p>intro</p>\n<h2>Pricing</h2>\n<p>new price</p>\n<h2>FAQ</h2>\n<p>faq</p>\n');
    expect(out.before).toContain('old price');
    expect(out.before).toContain('sub body');
  });
  it('replaces a sub-section up to the next heading of equal or higher level', () => {
    expect(patchSection(html, 'Sub', 'X').content).toContain('<h3>Sub</h3>\nX\n<h2>FAQ</h2>');
  });
  it('handles the last section and markdown headings', () => {
    expect(patchSection(html, 'FAQ', '<p>q</p>').content.endsWith('<h2>FAQ</h2>\n<p>q</p>\n')).toBe(true);
    const md = '# A\ntext\n## B\nold\n## C\nkeep';
    expect(patchSection(md, 'B', 'new').content).toBe('# A\ntext\n## B\nnew\n## C\nkeep');
  });
  it('matches headings through inline tags and entities, rejects missing or ambiguous', () => {
    expect(patchSection('<h2>Fish &amp; <em>chips</em></h2><p>a</p>', 'Fish & chips', 'b').content).toBe('<h2>Fish &amp; <em>chips</em></h2>\nb');
    expect(() => patchSection(html, 'Nope', 'x')).toThrow(expect.objectContaining({ code: 'heading-not-found' }));
    expect(() => patchSection('<h2>A</h2>x<h2>A</h2>y', 'A', 'z')).toThrow(expect.objectContaining({ code: 'heading-ambiguous' }));
  });
  it('works on a heading with no body and no trailing newline', () => {
    expect(patchSection('<h2>A</h2>', 'A', 'z').content).toBe('<h2>A</h2>\nz');
  });
});

describe('diffLines', () => {
  it('marks added, deleted and unchanged lines', () => {
    expect(diffLines('a\nb\nc', 'a\nx\nc')).toEqual([
      { kind: 'same', text: 'a' }, { kind: 'del', text: 'b' }, { kind: 'add', text: 'x' }, { kind: 'same', text: 'c' },
    ]);
    expect(diffLines('a', 'a\nb\nc').map((l) => l.kind)).toEqual(['same', 'add', 'add']);
    expect(diffLines('a\nb', 'a').map((l) => l.kind)).toEqual(['same', 'del']);
    expect(hasChanges(diffLines('same', 'same'))).toBe(false);
    expect(hasChanges(diffLines('a', 'b'))).toBe(true);
  });
  it('falls back to block replace above the cap', () => {
    const big = Array.from({ length: 2001 }, (_, i) => `l${i}`).join('\n');
    const out = diffLines(big, 'x');
    expect(out.filter((l) => l.kind === 'del')).toHaveLength(2001);
    expect(out.filter((l) => l.kind === 'add')).toHaveLength(1);
  });
});

describe('SSRF guard', () => {
  it.each([
    'http://cms.example.com', 'https://user:pw@cms.example.com', 'https://127.0.0.1', 'https://localhost',
    'https://10.0.0.5/x', 'https://169.254.169.254/latest', 'https://[::1]/', 'https://[::ffff:10.0.0.1]/', 'https://intranet.internal', 'not a url', 'ftp://x.com',
  ])('rejects %s', (url) => {
    expect(() => assertSafeCmsUrl(url)).toThrow(CmsError);
  });
  it('accepts public https and builds urls that cannot change host', () => {
    expect(assertSafeCmsUrl('https://cms.example.com/').hostname).toBe('cms.example.com');
    expect(cmsUrl('https://cms.example.com/blog/', '/wp-json/x', { a: 'b' })).toBe('https://cms.example.com/blog/wp-json/x?a=b');
    expect(() => cmsUrl('https://cms.example.com', '@127.0.0.1/x')).toThrow(CmsError);
  });
});

describe('locale coverage', () => {
  it('has a message for every error code in en', async () => {
    const en = (await import('@/i18n/locales/en.json')).default.cmsUi;
    for (const code of ['unsafe-url', 'conflict', 'http', 'bad-response', 'heading-not-found', 'heading-ambiguous', 'forbidden', 'not-approved', 'fact-gate-required']) {
      expect((en.error as Record<string, string>)[code]).toBeTruthy();
    }
  });
});

describe('sectionApplied', () => {
  it('tolerates CMS whitespace rewrapping only', () => {
    expect(sectionApplied('<p>new\n  price</p>', '<p>new price</p>')).toBe(true);
    expect(sectionApplied('<p>old</p>', '<p>new price</p>')).toBe(false);
  });
});
