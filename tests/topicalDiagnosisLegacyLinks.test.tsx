import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createCrawlPageFixture } from './fixtures/crawl';
import { buildTopicalDiagnosis } from '@/services/topicalDiagnosis';
import { TopicalDiagnosisView } from '@/components/Charts/crawlArchitecture/topicalDiagnosis/TopicalDiagnosisView';
import i18n from '@/i18n';

const link = (target_url: string) => ({ target_url, anchor_text: 'x', is_internal: true });
const page = (url: string, patch: Record<string, unknown> = {}) => createCrawlPageFixture({
  url, final_url: url, semantic_language: 'pl', word_count: 800, hreflangs: [], ...patch,
});
const codes = (report: ReturnType<typeof buildTopicalDiagnosis>) => [...new Set(report.verdicts.map((verdict) => verdict.code))].sort();
const posts = ['a', 'b', 'c'].map((slug) => `https://ex.test/blog/${slug}/`);
const terms = [['navigator', 'alerty', 'crm'], ['navigator', 'alerty', 'teams'], ['navigator', 'alerty', 'crm']];

/** A crawl saved before main-content links were captured: `links` only, no `semantic_links`. */
const legacyRun = () => posts.map((url, index) => page(url, {
  semantic_terms: terms[index], title: `Alerty Navigatora ${index}`, links: [link('https://ex.test/blog/')],
  content_hash: index === 1 ? 'other' : 'same',
}));
const currentRun = () => legacyRun().map((entry) => ({ ...entry, semantic_links: [] }));

describe('a crawl saved without main-content links', () => {
  const report = buildTopicalDiagnosis(legacyRun(), 'https://ex.test/');

  it('reports that link evidence is missing instead of calling every page an orphan', () => {
    expect(report.noContentLinks).toBe(true);
    expect(codes(report)).not.toContain('document-orphan');
  });

  it('keeps the verdicts that need no links and drops every verdict that does', () => {
    expect(report.stats.topics).toBe(1);
    expect(codes(report)).toEqual(['near-duplicate']);
  });

  it('tells the user why link verdicts are absent', () => {
    render(<TopicalDiagnosisView report={report} onShowInGraph={() => undefined} onOpenPage={() => undefined} />);
    expect(screen.getByText(i18n.t('topicalDiagnosis.noContentLinks'))).toBeTruthy();
  });
});

describe('a crawl saved with main-content links', () => {
  const report = buildTopicalDiagnosis(currentRun(), 'https://ex.test/');

  it('still reports pages without any content link as orphans', () => {
    expect(report.noContentLinks).toBe(false);
    expect(codes(report)).toEqual(['document-orphan', 'near-duplicate', 'topic-members-unlinked', 'topic-no-hub']);
  });

  it('shows no notice about missing links', () => {
    render(<TopicalDiagnosisView report={report} onShowInGraph={() => undefined} onOpenPage={() => undefined} />);
    expect(screen.queryByText(i18n.t('topicalDiagnosis.noContentLinks'))).toBeNull();
  });
});
