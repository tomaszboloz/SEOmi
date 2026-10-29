import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrustHero } from '@/components/Domain/crawlResults/trust/TrustHero';
import { TrustJsonLdGenerator } from '@/components/Domain/crawlResults/trust/TrustJsonLdGenerator';
import i18n from '@/i18n';
import { copyText } from '@/services/clipboard';
import type { TrustJsonLdInput, TrustReport, TrustSnapshot } from '@/services/eeatTrust';

vi.mock('@/services/clipboard', () => ({ copyText: vi.fn() }));

const LOCALES = ['en', 'pl', 'es', 'de', 'fr', 'it', 'pt', 'ru', 'ja', 'zh', 'ko', 'ar'] as const;

const makeTrustReport = (extra: Partial<TrustReport> = {}): TrustReport => ({
  score: 65, level: 'adequate',
  layers: { schemaGraph: 75, authorAlignment: undefined, citationQuality: undefined, transparency: 60 },
  ymyl: 'health', ymylUnattributedPct: 20, pageCount: 10, articleCount: 4, generatedAt: '2026-10-20T00:00:00.000Z', version: 1,
  schema: { organization: { present: true, hasId: true, sameAs: [], name: 'Org' }, articleCount: 4, articlesWithAuthor: 4, articlesWithDate: 4, articlesWithReviewer: 1, articlesWithCitation: 2, personCount: 1, personsWithId: 1, personsWithSameAs: 1 },
  authors: [], findings: [],
  citations: { pagesAnalyzed: 4, pagesWithTrusted: 2, pagesWithAnyExternal: 2, trustedLinks: 2, externalLinks: 2, checkedLinks: 2, deadLinks: [], pagesWithScholarly: 0, scholarlySources: 0 },
  transparency: { found: { editorial: undefined, about: undefined, contact: undefined, registry: undefined }, datedArticles: 4, articles: 4 },
  ...extra,
});

const sampleJsonLdInput: TrustJsonLdInput = {
  personName: 'Dr. Jane Smith', jobTitle: 'Reviewer', personUrl: 'https://ex.test/j', organizationName: 'Group',
  organizationUrl: 'https://ex.test', pageUrl: 'https://ex.test/g', dateModified: '2026-10-20', lastReviewed: '2026-10-22',
  sameAs: ['https://orcid.org/0000-0002'], asReviewer: true,
};

beforeEach(async () => {
  await i18n.changeLanguage('en');
  vi.clearAllMocks();
});

describe('geminiAITrust08 - TrustHero 12-locale mounting & unknown status boundary', () => {
  it.each(LOCALES)('mounts TrustHero with localized level, noData for unknown layers in %s', async (lang) => {
    await i18n.changeLanguage(lang);
    const prev: TrustSnapshot = { runId: 'run-1', at: '2026-10-01T00:00:00.000Z', score: 55, layers: { schemaGraph: 50, transparency: 60 } };
    render(<TrustHero report={makeTrustReport()} previous={prev} />);

    const meter = screen.getByRole('meter');
    expect(meter.getAttribute('aria-label')).toBe(i18n.t('trust.hero.label'));
    expect(meter.getAttribute('aria-valuenow')).toBe('65');
    expect(screen.getByTestId('trust-score').textContent).toBe('65');

    const noDataElements = screen.getAllByText(i18n.t('trust.layers.noData'));
    expect(noDataElements.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('alert').textContent).toBe(i18n.t('trust.hero.unattributed', { pct: 20 }));

    for (const id of ['trust.trustScore', 'trust.ymyl', 'trust.schemaGraph', 'trust.authorAlignment']) {
      const tip = document.querySelector(`button[data-help-id="${id}"]`);
      expect(tip).not.toBeNull();
      expect(tip?.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('renders unverified badge when citations are unverified and zero when layer score is 0', () => {
    const unverifiedCitations = {
      pagesAnalyzed: 4, pagesWithTrusted: 0, pagesWithAnyExternal: 2, trustedLinks: 0,
      externalLinks: 2, checkedLinks: 0, deadLinks: [], pagesWithScholarly: 0, scholarlySources: 0,
    };
    const report = makeTrustReport({
      layers: { schemaGraph: 0, authorAlignment: 50, citationQuality: 30, transparency: 0 },
      citations: unverifiedCitations,
    });
    render(<TrustHero report={report} />);
    expect(screen.getByText(i18n.t('trust.layers.unverified'))).toBeTruthy();
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(2);
  });
});

describe('geminiAITrust08 - TrustJsonLdGenerator copy failure & keyboard labels', () => {
  it.each(LOCALES)('handles copy failure and success status announcements in %s', async (lang) => {
    await i18n.changeLanguage(lang);
    vi.mocked(copyText).mockResolvedValueOnce(false);
    const onClose = vi.fn();

    const { rerender } = render(<TrustJsonLdGenerator initial={sampleJsonLdInput} onClose={onClose} />);
    const copyBtn = screen.getByRole('button', { name: i18n.t('trust.generator.copy') });

    fireEvent.click(copyBtn);
    await vi.waitFor(() => {
      const failEl = screen.getByText(i18n.t('trust.generator.copyFailed'));
      expect(failEl.getAttribute('role')).toBe('status');
    });

    vi.mocked(copyText).mockResolvedValueOnce(true);
    rerender(<TrustJsonLdGenerator initial={sampleJsonLdInput} onClose={onClose} />);
    fireEvent.click(copyBtn);
    await vi.waitFor(() => {
      const okEl = screen.getByText(i18n.t('trust.generator.copied'));
      expect(okEl.getAttribute('role')).toBe('status');
    });
  });

  it('validates required fields, exposes accessible preview, and triggers close', () => {
    const onClose = vi.fn();
    render(<TrustJsonLdGenerator initial={sampleJsonLdInput} onClose={onClose} />);

    expect(document.querySelector('pre')?.getAttribute('aria-label')).toBe(i18n.t('trust.generator.preview'));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('trust.generator.close') }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText(i18n.t('trust.generator.field.personName')), { target: { value: '' } });
    expect(screen.getByRole('alert')).toBeTruthy();
    expect((screen.getByRole('button', { name: i18n.t('trust.generator.copy') }) as HTMLButtonElement).disabled).toBe(true);
  });
});
