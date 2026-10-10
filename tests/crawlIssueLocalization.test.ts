import { afterEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { inferCrawlIssueMessageKey, localizeCrawlIssue } from '@/services/crawlIssueLocalization';

describe('crawler issue localization', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('localizes legacy crawler messages without changing the stored message', async () => {
    await i18n.changeLanguage('pl');
    const issue = {
      severity: 'Critical' as const,
      message: 'Missing <title> tag',
    };

    const localized = localizeCrawlIssue(issue, i18n.t.bind(i18n));

    expect(localized.message).toBe(issue.message);
    expect(localized.displayMessage).toBe('Brak tagu <title> strony');
    expect(localized.displayMessage).not.toBe(issue.message);
  });

  it('interpolates crawler evidence and keeps unknown diagnostics intact', async () => {
    await i18n.changeLanguage('de');
    const canonical = localizeCrawlIssue(
      { severity: 'Warning', message: 'Multiple canonical links found (3)' },
      i18n.t.bind(i18n),
    );
    const unknown = localizeCrawlIssue(
      { severity: 'Info', message: 'Browser console error: custom diagnostic' },
      i18n.t.bind(i18n),
    );

    expect(canonical.displayMessage).toContain('3');
    expect(canonical.displayMessage).toContain('Canonical');
    expect(unknown.displayMessage).toBe('Technisches Detail: Browser console error: custom diagnostic');
  });

  it('localizes a render fallback while keeping the renderer reason verbatim', async () => {
    await i18n.changeLanguage('pl');
    const reason = 'Rendered page capture timed out after 60 seconds.';
    const issue = { severity: 'Warning' as const, message: `Browser rendering failed; the raw HTML response was analyzed instead: ${reason}` };
    const fallback = localizeCrawlIssue(issue, i18n.t.bind(i18n));
    expect(fallback.displayMessage).toBe(`Renderowanie w przeglądarce nie powiodło się; przeanalizowano surową odpowiedź HTML: ${reason}`);
    expect(fallback.message).toBe(issue.message);
    expect(inferCrawlIssueMessageKey({ severity: 'Warning', message: 'Browser rendering failed' })).toBeNull();
  });

  it('chooses the correct localized length wording for short and long metadata', async () => {
    await i18n.changeLanguage('en');
    const shortTitle = localizeCrawlIssue(
      { severity: 'Info', message: 'Title length is 12 characters; reference range is 30–60' },
      i18n.t.bind(i18n),
    );
    const longDescription = localizeCrawlIssue(
      { severity: 'Info', message: 'Meta description length is 180 characters; reference range is 70–160' },
      i18n.t.bind(i18n),
    );

    expect(shortTitle.displayMessage).toContain('too short');
    expect(longDescription.displayMessage).toContain('too long');
  });

  it.each([
    ['Missing <title> tag', 'auditIssues.messages.meta_title_missing'],
    ['Multiple <title> tags found (3)', 'crawlIssues.multipleTitle'],
    ['Missing <h1> tag', 'auditIssues.messages.headings_h1_missing'],
    ['Multiple <h1> tags found (2)', 'auditIssues.messages.headings_h1_multiple'],
    ['Heading hierarchy skips one or more levels', 'auditIssues.messages.headings_hierarchy_skip'],
    ['Missing meta description tag', 'auditIssues.messages.meta_description_missing'],
    ['Meta description is empty', 'crawlIssues.emptyDescription'],
    ['Multiple meta description tags found (2)', 'crawlIssues.multipleDescription'],
    ['Missing canonical link', 'auditIssues.messages.meta_canonical_missing'],
    ['Multiple canonical links found (2)', 'crawlIssues.multipleCanonical'],
    ['Canonical declaration has a missing, invalid, or non-HTTP URL', 'crawlIssues.invalidCanonical'],
    ['Page declares noindex in meta robots', 'auditIssues.messages.meta_robots_noindex'],
    ['Response declares noindex in X-Robots-Tag', 'auditIssues.messages.indexability_xrobots_noindex'],
    ['Page declares nofollow in meta robots', 'crawlIssues.nofollowMeta'],
    ['Response declares nofollow in X-Robots-Tag', 'crawlIssues.nofollowHeader'],
    ['Canonical points to a different URL; the target was not validated in this verdict', 'crawlIssues.canonicalElsewhere'],
    ['Canonical and noindex are both present; review the intended indexing signal', 'crawlIssues.canonicalConflict'],
    ['Document has no html lang attribute', 'crawlIssues.missingLanguage'],
    ['Duplicate normalized page content found in this crawl', 'crawlIssues.duplicateContent'],
    ['Thin text content: 3 words', 'crawlIssues.thinContent'],
    ['2 invalid JSON-LD block(s)', 'crawlIssues.invalidJsonLd'],
    ['Client-side refresh redirect detected (1 declaration(s))', 'crawlIssues.clientRedirect'],
    ['2 pagination declaration(s) have a missing or invalid HTTP(S) target', 'crawlIssues.paginationInvalid'],
    ['Browser rendering failed; the raw HTML response was analyzed instead: Rendered page capture timed out after 60 seconds.', 'crawlIssues.renderFallback'],
    ['The page navigated to a different URL in the browser; the HTTP status and response headers describe the requested URL', 'crawlIssues.renderedSelfNavigation'],
    ['Duplicate title found in this crawl', 'crawl.metadataFacets.duplicateTitleDescription'],
    ['Duplicate meta description found in this crawl', 'crawl.metadataFacets.duplicateDescriptionDescription'],
    ['Title length is 61 characters; reference range is 30–60', 'auditIssues.messages.meta_title_long'],
    ['Meta description length is 30 characters; reference range is 70–160', 'auditIssues.messages.meta_description_short'],
  ])('identifies legacy diagnostic %s without changing its evidence', (message, expected) => {
    const issue = Object.freeze({ severity: 'Info' as const, message });
    expect(inferCrawlIssueMessageKey(issue)).toBe(expected);
    expect(issue.message).toBe(message);
  });

  it('prefers a recognized stable diagnostic code and refuses to guess an unrelated message', () => {
    expect(inferCrawlIssueMessageKey({ severity: 'Info', code: 'crawl-missing-language', message: 'Missing <title> tag' })).toBe('crawlIssues.missingLanguage');
    expect(inferCrawlIssueMessageKey({ severity: 'Info', code: 'new-provider-code', message: 'Missing <h1> tag' })).toBe('auditIssues.messages.headings_h1_missing');
    expect(inferCrawlIssueMessageKey({ severity: 'Info', message: 'Title length unknown: provider failure' })).toBeNull();
  });
});
