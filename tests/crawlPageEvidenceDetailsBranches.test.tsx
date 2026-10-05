import { beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import i18n from '@/i18n';
import { CrawlPageEvidenceDetails } from '@/components/Domain/crawlResults/pageTable/CrawlPageEvidenceDetails';
import type { CrawledPageSummary } from '@/types';

const base = { url: 'https://a.test/', depth: 2, response_time_ms: 120, issues: [], redirect_chain: [], word_count: 300 };
const show = (over: Record<string, unknown> = {}, evidenceUrl: string | null = null) => {
  const t = i18n.t.bind(i18n);
  const { container } = render(<CrawlPageEvidenceDetails page={{ ...base, ...over } as unknown as CrawledPageSummary} evidenceUrl={evidenceUrl} t={t as never} />);
  return { text: container.textContent ?? '', details: container.querySelector('details') as HTMLDetailsElement, container };
};
const ui = (k: string, o?: Record<string, unknown>) => i18n.t(`crawl.ui.${k}`, o);

describe('CrawlPageEvidenceDetails', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); });

  it('is closed by default with a show label and opens for the evidence url', () => {
    const closed = show();
    expect(closed.details.open).toBe(false);
    expect(closed.text).toContain(ui('showEvidence'));
    const open = show({}, 'https://a.test/');
    expect(open.details.open).toBe(true);
    expect(open.text).toContain(ui('pageEvidence'));
    expect(show({}, 'https://other/').details.open).toBe(false);
  });

  it('shows the HTTP status, falls back to the transport error and to no response', () => {
    expect(show({ http_status: 200 }).text).toContain(`${ui('status')}: 200`);
    const failed = show({ request_error_kind: 'dns' });
    expect(failed.text).toContain(`${ui('transport')}:`);
    expect(failed.text).toContain('(dns)');
    expect(show().text).toContain(`${ui('status')}: ${ui('noResponse')}`);
    expect(show({ http_status: 200 }).text).not.toContain(`${ui('transport')}:`);
  });

  it('shows the final url, indexability, canonical and verdict reasons', () => {
    const t1 = show({ final_url: 'https://a.test/final', indexability_status: 'indexable', canonical: 'https://a.test/c', indexability_verdict: { status: 'ok', reasons: ['r1', 'r2'] } }).text;
    expect(t1).toContain(`${ui('finalUrl')}: https://a.test/final`);
    expect(t1).toContain(`${ui('indexability')}: indexable · canonical: https://a.test/c`);
    expect(t1).toContain(`${ui('indexabilityVerdict')}: ok · r1, r2`);
    const t2 = show({ indexability_verdict: { status: 'ok', reasons: [] } }).text;
    expect(t2).toContain(`${ui('finalUrl')}: https://a.test/`);
    expect(t2).toContain(`${ui('indexability')}: ${ui('notDetermined')}`);
    expect(t2).toContain(`${ui('indexabilityVerdict')}: ok`);
    expect(t2).not.toContain('canonical:');
  });

  it('omits the content line without sentence or complexity data', () => {
    expect(show().text).not.toContain(ui('content'));
  });

  it('renders the full content metrics line', () => {
    const t = show({ sentence_count: 20, average_words_per_sentence: 15.04, complexity_score: 42, complexity_label: 'Medium', readability_ease_score: 61.4, readability_grade: 8.26 }).text;
    expect(t).toContain(`${ui('content')} 300 ${ui('words')} · 20 ${ui('sentences')} · 15.0 ${ui('wordsPerSentence')} · ${ui('complexity')} 42/100 (Medium) · ${ui('readability')} 61/100 · ${ui('grade')} 8.3`);
  });

  it('renders partial content metrics', () => {
    const only = show({ complexity_score: 10 }).text;
    expect(only).toContain(`${ui('complexity')} 10/100`);
    expect(only).not.toContain('(');
    expect(only).not.toContain(ui('sentences'));
    const ease = show({ sentence_count: 1, readability_ease_score: 70 }).text;
    expect(ease).toContain(`${ui('readability')} 70/100`);
    expect(ease).not.toContain(ui('grade'));
  });

  it('renders the focus phrase, discovery sources and redirect chain', () => {
    const t = show({
      focus_phrase: { phrase: 'seo tools', body_occurrences: 4, body_density_percent: 1.26, title_occurrences: 1, meta_description_occurrences: 0, h1_occurrences: 1 },
      discovery_sources: [{ kind: 'sitemap', source_url: 'https://a.test/sitemap.xml' }, { kind: 'link', source_url: 'https://a.test/', anchor_text: 'Home' }, { kind: 'seed' }],
      redirect_chain: [{ from_url: 'https://a.test/1', to_url: 'https://a.test/2', http_status: 301, response_time_ms: 15 }, { from_url: 'https://a.test/2', to_url: 'https://a.test/3', http_status: 302, response_time_ms: null }],
      redirect_stop_reason: 'loop detected',
    }).text;
    expect(t).toContain(ui('focusPhrase', { phrase: 'seo tools', body: 4, density: '1.3', title: 1, meta: 0, h1: 1 }));
    expect(t).toContain(ui('urlDiscovery'));
    expect(t).toContain('https://a.test/sitemap.xml');
    expect(t).toContain('„Home”');
    expect(t).toContain(`https://a.test/1 → https://a.test/2 · 15 ${i18n.t('performance.milliseconds')}`);
    expect(t).toContain(`https://a.test/2 → https://a.test/3 · ${i18n.t('exportUi.statuses.timingUnavailable')}`);
    expect(t).toContain(`${ui('redirectStopReason')}: loop detected`);
  });

  it('hides the optional sections when there is no data', () => {
    const t = show().text;
    for (const key of ['urlDiscovery', 'redirectStopReason']) expect(t).not.toContain(ui(key));
  });
});
