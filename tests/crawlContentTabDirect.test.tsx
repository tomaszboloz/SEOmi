import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CrawlContentTab } from '@/components/Domain/crawlResults/CrawlContentTab';
import type { useCrawlResultsSession } from '@/components/Domain/crawlResults/useCrawlResultsSession';
import type { CrawledPageSummary } from '@/types';
import { createCrawlPageFixture, createCrawlResultFixture } from './fixtures/crawl';
import i18n from '@/i18n';

const show = (patch: Partial<CrawledPageSummary>) => {
  const result = createCrawlResultFixture({ pages: [createCrawlPageFixture(patch)] });
  return render(<CrawlContentTab session={{ result, t: i18n.t.bind(i18n) } as ReturnType<typeof useCrawlResultsSession>} />);
};
const cells = () => within(screen.getAllByRole('row')[1]).getAllByRole('cell');

describe('crawl content observed and legacy evidence', () => {
  it('keeps absent content metrics unavailable', () => {
    show({ title: null, meta_description: null, content_terms: [], duplicate_headings: [] });
    const row = cells();
    expect(row[0].title).toBe('https://example.test/');
    expect(row[1].textContent).toBe('—');
    expect(row[1].getAttribute('title')).toBeNull();
    expect(row[2].textContent).toBe('—');
    expect(row[4].textContent).toBe('—');
    expect(row[5].textContent).toBe('—');
    expect(row[6].textContent).toBe('—');
    expect(row[7].textContent).toBe('—');
    expect(row[7].getAttribute('title')).toBeNull();
    expect(row[8].textContent).toBe('—');
    expect(row[9].textContent).toBe('—');
    expect(row[10].textContent).toBe('—');
    expect(row[11].textContent).toBe('—');
    expect(row[12].textContent).toBe(i18n.t('crawlDeepUi.noTextComparison'));
  });
  it('preserves measured zeros, truncates terms and exposes observed formula and duplicate headings', () => {
    show({ title: 'Observed title', meta_description: 'Observed description', sentence_count: 0,
      text_ratio_percent: 0, complexity_score: 0, complexity_label: 'Simple', readability_ease_score: 0,
      readability_label: 'Difficult', readability_method: 'Flesch', document_language: 'pl',
      content_terms: Array.from({ length: 9 }, (_, index) => ({ term: `term${index}`, count: 1, density_percent: 1.25 })),
      focus_phrase: { phrase: 'target', body_occurrences: 0, body_density_percent: 0, title_occurrences: 0,
        meta_description_occurrences: 0, h1_occurrences: 0 },
      duplicate_headings: [{ text: 'Repeated', levels: [1, 2], occurrences: 2 }],
      content_hash: 'abcdefghijklmnop', content_simhash: '1234' });
    const row = cells();
    expect(row[1].title).toBe('Observed title');
    expect(row[2].title).toBe('Observed description');
    expect(row[4].textContent).toBe('0');
    expect(row[5].textContent).toBe('0%');
    expect(row[6].textContent).toBe('0/100Simple');
    expect(row[7].textContent).toBe('0/100Difficult');
    expect(row[7].title).toBe(`${i18n.t('crawl.ui.formula')}: Flesch`);
    expect(row[8].textContent).toContain('term7 1.3%');
    expect(row[8].textContent).not.toContain('term8');
    expect(row[9].textContent).toBe('target: body 0 (0.0%) · title 0 · H1 0');
    expect(row[10].textContent).toBe('pl');
    expect(screen.getByTitle('Repeated').textContent).toBe('H1/H2 × 2: Repeated');
    expect(row[12].textContent).toBe('abcdefghijkl… / 1234');
  });
  it('shows a fingerprint without a simhash and rounds the measured ease score', () => {
    show({ content_hash: 'abcdefghijklmnop', readability_ease_score: 42.6 });
    expect(cells()[12].textContent).toBe('abcdefghijkl…');
    expect(cells()[7].textContent).toBe('43/100');
  });
});
