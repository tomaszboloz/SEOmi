import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrustHero } from '@/components/Domain/crawlResults/trust/TrustHero';
import { TrustJsonLdGenerator } from '@/components/Domain/crawlResults/trust/TrustJsonLdGenerator';
import i18n from '@/i18n';
import { copyText } from '@/services/clipboard';
import type { TrustReport, TrustSnapshot } from '@/services/eeatTrust';

vi.mock('@/services/clipboard', () => ({ copyText: vi.fn() }));
vi.mock('@/services/eeatTrust/citations', () => ({
  citationsUnverified: vi.fn((citations) => Boolean(citations?.unverified)),
}));

const LOCALES = ['en', 'pl', 'es', 'de', 'fr', 'it', 'pt', 'ru', 'ja', 'zh', 'ko', 'ar'] as const;

const makeTrustReport = (extra: Partial<TrustReport> = {}): TrustReport => ({
  score: 65,
  level: 'adequate',
  articleCount: 4,
  pageCount: 10,
  ymyl: 'health',
  ymylUnattributedPct: 20,
  layers: {
    schemaGraph: 75,
    authorAlignment: undefined,
    citationQuality: undefined,
    transparency: 60,
  },
  citations: { totalLinks: 0, checkedCount: 0, brokenCount: 0, unverified: false } as any,
  authors: [],
  publishers: [],
  trustPages: [],
  issues: [],
  ...extra,
});

const sampleJsonLdInput = {
  personName: 'Dr. Jane Smith',
  jobTitle: 'Medical Reviewer',
  personUrl: 'https://example.test/jane',
  organizationName: 'Health Group',
  organizationUrl: 'https://example.test',
  pageUrl: 'https://example.test/guide',
  dateModified: '2026-10-20',
  lastReviewed: '2026-10-22',
  sameAs: ['https://orcid.org/0000-0002'],
  asReviewer: true,
};

beforeEach(async () => {
  await i18n.changeLanguage('en');
  vi.clearAllMocks();
});

describe('geminiAITrust08 - TrustHero 12-locale mounting & unknown status boundary', () => {
  it.each(LOCALES)('mounts TrustHero with localized level, noData for unknown layers in %s', async (lang) => {
    await i18n.changeLanguage(lang);
    const prev: TrustSnapshot = { score: 55, level: 'weak', createdAt: '2026-10-01' } as any;
    render(<TrustHero report={makeTrustReport()} previous={prev} />);

    expect(screen.getByRole('meter', { name: i18n.t('trust.hero.label') })).toBeTruthy();
    expect(screen.getByTestId('trust-score').textContent).toBe('65');

    const noDataLabel = i18n.t('trust.layers.noData');
    const noDataElements = screen.getAllByText(noDataLabel);
    expect(noDataElements.length).toBeGreaterThanOrEqual(2);

    expect(screen.getByRole('alert').textContent).toBe(i18n.t('trust.hero.unattributed', { pct: 20 }));

    for (const id of ['trust.trustScore', 'trust.ymyl', 'trust.schemaGraph', 'trust.authorAlignment']) {
      const tip = document.querySelector(`button[data-help-id="${id}"]`);
      expect(tip).not.toBeNull();
      expect(tip?.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('renders unverified badge when citations are unverified and zero when layer score is 0', () => {
    const report = makeTrustReport({
      layers: { schemaGraph: 0, authorAlignment: 50, citationQuality: 30, transparency: 0 },
      citations: { unverified: true } as any,
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
      expect(screen.getByRole('status').textContent).toBe(i18n.t('trust.generator.copyFailed'));
    });

    vi.mocked(copyText).mockResolvedValueOnce(true);
    rerender(<TrustJsonLdGenerator initial={sampleJsonLdInput} onClose={onClose} />);
    fireEvent.click(copyBtn);
    await vi.waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe(i18n.t('trust.generator.copied'));
    });
  });

  it('validates required fields, exposes accessible preview, and triggers close', () => {
    const onClose = vi.fn();
    render(<TrustJsonLdGenerator initial={sampleJsonLdInput} onClose={onClose} />);

    expect(screen.getByLabelText(i18n.t('trust.generator.preview'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('trust.generator.close') }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText(i18n.t('trust.generator.field.personName')), { target: { value: '' } });
    expect(screen.getByRole('alert')).toBeTruthy();
    expect((screen.getByRole('button', { name: i18n.t('trust.generator.copy') }) as HTMLButtonElement).disabled).toBe(true);
  });
});
