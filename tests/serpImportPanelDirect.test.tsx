import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { SerpImportPanel } from '@/components/Keywords/embeddingClustering/SerpImportPanel';
import { useFreeSerpSession } from '@/components/Keywords/embeddingClustering/useFreeSerpSession';

vi.mock('@/components/Keywords/embeddingClustering/useFreeSerpSession', () => ({
  useFreeSerpSession: vi.fn(),
}));

const mockFeed = {
  fetching: false,
  error: null,
  fetchBing: vi.fn(),
  cancel: vi.fn(),
};

describe('SerpImportPanel direct contracts', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.clearAllMocks();
    vi.mocked(useFreeSerpSession).mockReturnValue(mockFeed as never);
  });

  it('updates keyword, country, language, format and payload, and triggers actions', () => {
    const onImport = vi.fn();
    const onClear = vi.fn();

    render(
      <SerpImportPanel
        projectId="project-1"
        imported={null}
        error={null}
        onImport={onImport}
        onClear={onClear}
      />,
    );

    const queryInput = screen.getByLabelText(i18n.t('serpImportUi.query'));
    const countryInput = screen.getByLabelText(i18n.t('serpImportUi.country'));
    const languageInput = screen.getByLabelText(i18n.t('serpImportUi.language'));
    const formatSelect = screen.getByLabelText(i18n.t('serpImportUi.format'));
    const payloadInput = screen.getByLabelText(i18n.t('serpImportUi.payload'));

    fireEvent.change(queryInput, { target: { value: 'best headphones' } });
    fireEvent.change(countryInput, { target: { value: 'US' } });
    fireEvent.change(languageInput, { target: { value: 'en' } });
    fireEvent.change(formatSelect, { target: { value: 'csv' } });
    fireEvent.change(payloadInput, { target: { value: 'keyword,url\na,https://a.test' } });

    const fetchBtn = screen.getByRole('button', { name: i18n.t('serpImportUi.fetch') });
    fireEvent.click(fetchBtn);
    expect(mockFeed.fetchBing).toHaveBeenCalled();

    const importBtn = screen.getByRole('button', { name: i18n.t('serpImportUi.import') });
    fireEvent.click(importBtn);
    expect(onImport).toHaveBeenCalledWith('keyword,url\na,https://a.test', 'csv');
  });

  it('renders errors, blocked status, and imported snapshot report with partial notice', () => {
    vi.mocked(useFreeSerpSession).mockReturnValue({
      ...mockFeed,
      error: { status: 'blocked', message: 'Rate limit' },
    } as never);

    const imported = {
      importedAt: '2026-10-06T12:00:00Z',
      result: {
        snapshots: [{ keyword: 'test', urls: [] }],
        rejected: [],
        source: {
          provider: 'Bing',
          availability: 'available',
          countryCode: 'US',
          languageCode: 'en',
          capturedAt: '2026-10-06T12:00:00Z',
          retrievedAt: '2026-10-06T12:00:00Z',
          kind: 'bing-rss' as const,
        },
      },
    };

    const onClear = vi.fn();
    render(
      <SerpImportPanel
        projectId="project-1"
        imported={imported as never}
        error="Invalid payload"
        onImport={vi.fn()}
        onClear={onClear}
      />,
    );

    expect(screen.getByText(new RegExp(i18n.t('serpImportUi.feedBlocked')))).toBeTruthy();
    expect(screen.getByText('Invalid payload')).toBeTruthy();
    expect(screen.getByText(i18n.t('serpImportUi.partialNotice'))).toBeTruthy();

    const clearBtn = screen.getByRole('button', { name: i18n.t('serpImportUi.clear') });
    fireEvent.click(clearBtn);
    expect(onClear).toHaveBeenCalled();
  });
});
