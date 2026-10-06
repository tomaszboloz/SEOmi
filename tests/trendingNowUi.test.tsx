import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrendingNowPanel } from '@/components/KeywordResearch/TrendingNowPanel';
import { TrendingNowControls } from '@/components/KeywordResearch/TrendingNowControls';
import { TrendingNowSnapshot } from '@/components/KeywordResearch/TrendingNowSnapshot';
import { useProjectStore } from '@/stores/projectStore';
import { MAX_TRENDING_PAYLOAD_BYTES, type TrendingSnapshot } from '@/services/trendingNow';
import i18n from '@/i18n';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(), importFile: vi.fn(), read: vi.fn(), save: vi.fn(), clear: vi.fn(),
}));

vi.mock('@/services/trendingNow', async () => ({
  ...(await vi.importActual<typeof import('@/services/trendingNow')>('@/services/trendingNow')),
  fetchTrendingNow: mocks.fetch,
  importTrendingNow: mocks.importFile,
  readTrendingNow: mocks.read,
  saveTrendingNow: mocks.save,
  clearTrendingNow: mocks.clear,
}));

const snapshot: TrendingSnapshot = {
  projectId: 'p1', geo: 'US', capturedAt: '2026-10-06T08:00:00.000Z',
  source: { kind: 'google-trends-rss', url: 'https://trends.google.com/trending/rss?geo=US' },
  entries: [{ keyword: 'rower', trafficLabel: '20K+', startedAt: 'Tue, 6 Oct 2026 01:00:00 -0700' }],
};

describe('Trending Now UI', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    useProjectStore.setState({ activeProjectId: null });
    mocks.fetch.mockReset(); mocks.importFile.mockReset(); mocks.read.mockReset();
    mocks.save.mockReset(); mocks.clear.mockReset();
    mocks.read.mockReturnValue(null); mocks.save.mockReturnValue(true); mocks.clear.mockReturnValue(true);
  });

  it('keeps controls disabled without a selected project', () => {
    render(<TrendingNowPanel />);
    expect((screen.getByRole('combobox', { name: 'Country' }) as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByText('Select a project to use Trending Now.')).toBeTruthy();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('refreshes the selected country, saves provenance and never renders a volume', async () => {
    useProjectStore.setState({ activeProjectId: 'p1' });
    mocks.fetch.mockResolvedValue(snapshot);
    render(<TrendingNowPanel />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Country' }), { target: { value: 'US' } });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh feed' }));
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledWith('p1', 'US'));
    expect(mocks.save).toHaveBeenCalledWith('p1', snapshot);
    expect(await screen.findByText('rower')).toBeTruthy();
    expect(screen.getByText('20K+')).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: /volume/i })).toBeNull();
    expect(screen.getByText('Source: Google Trends RSS')).toBeTruthy();
  });

  it('imports a bounded CSV file into the active project', async () => {
    useProjectStore.setState({ activeProjectId: 'p1' });
    mocks.importFile.mockReturnValue({ ...snapshot, source: { kind: 'csv-import', url: null } });
    render(<TrendingNowPanel />);
    const file = new File(['keyword,trafficLabel\nrower,20K+'], 'trends.csv', { type: 'text/csv' });
    fireEvent.change(screen.getByLabelText('Import CSV or JSON'), { target: { files: [file] } });
    await waitFor(() => expect(mocks.importFile).toHaveBeenCalledWith('p1', expect.any(String), 'csv', 'PL'));
    expect(mocks.save).toHaveBeenCalled();
  });

  it('shows truthful fetch errors and rejects oversized files before import', async () => {
    useProjectStore.setState({ activeProjectId: 'p1' });
    mocks.fetch.mockRejectedValue(new Error('CORS blocked'));
    render(<TrendingNowPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh feed' }));
    expect((await screen.findByRole('alert')).textContent).toContain('CORS blocked');
    expect(screen.queryByText(/DataForSEO/)).toBeNull();

    const oversized = { name: 'trends.csv', size: MAX_TRENDING_PAYLOAD_BYTES + 1 } as File;
    fireEvent.change(screen.getByLabelText('Import CSV or JSON'), { target: { files: [oversized] } });
    expect((await screen.findByRole('alert')).textContent).toContain('1 MiB');
    expect(mocks.importFile).not.toHaveBeenCalled();
  });

  it('renders empty snapshots, imported provenance and optional source fields', () => {
    render(<TrendingNowSnapshot snapshot={null} t={i18n.t} />);
    expect(screen.getByText('No snapshot for this project yet.')).toBeTruthy();
    const imported: TrendingSnapshot = { ...snapshot, source: { kind: 'json-import', url: null }, entries: [{ keyword: 'x', trafficLabel: null, startedAt: null }] };
    render(<TrendingNowSnapshot snapshot={imported} t={i18n.t} />);
    expect(screen.getByText('Source: JSON import')).toBeTruthy();
    expect(screen.getAllByText('Not provided')).toHaveLength(2);
  });

  it('keeps controls bounded and handles an empty file selection', () => {
    const onImport = vi.fn();
    render(<TrendingNowControls t={i18n.t} geo="PL" setGeo={vi.fn()} onRefresh={vi.fn()} onImport={onImport} onClear={vi.fn()} isLoading={false} hasSnapshot hasProject maxPayloadBytes={MAX_TRENDING_PAYLOAD_BYTES} />);
    fireEvent.click(screen.getByRole('button', { name: 'Import CSV or JSON' }));
    fireEvent.change(screen.getByLabelText('Import CSV or JSON'), { target: { files: [] } });
    expect(onImport).not.toHaveBeenCalled();
  });
});
