import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  beforeEach(() => {
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

    const queryInput = screen.getByLabelText(/serpImportUi\.query/i);
    const countryInput = screen.getByLabelText(/serpImportUi\.country/i);
    const languageInput = screen.getByLabelText(/serpImportUi\.language/i);
    const formatSelect = screen.getByLabelText(/serpImportUi\.format/i);
    const payloadInput = screen.getByLabelText(/serpImportUi\.payload/i);

    fireEvent.change(queryInput, { target: { value: 'best headphones' } });
    fireEvent.change(countryInput, { target: { value: 'US' } });
    fireEvent.change(languageInput, { target: { value: 'en' } });
    fireEvent.change(formatSelect, { target: { value: 'csv' } });
    fireEvent.change(payloadInput, { target: { value: 'keyword,url\na,https://a.test' } });

    const fetchBtn = screen.getByRole('button', { name: 'serpImportUi.fetch' });
    fireEvent.click(fetchBtn);
    expect(mockFeed.fetchBing).toHaveBeenCalled();

    const importBtn = screen.getByRole('button', { name: 'serpImportUi.import' });
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

    expect(screen.getByText(/serpImportUi\.feedBlocked/i)).toBeTruthy();
    expect(screen.getByText('Invalid payload')).toBeTruthy();
    expect(screen.getByText('serpImportUi.partialNotice')).toBeTruthy();

    const clearBtn = screen.getByRole('button', { name: 'serpImportUi.clear' });
    fireEvent.click(clearBtn);
    expect(onClear).toHaveBeenCalled();
  });
});
