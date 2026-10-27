import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { CrawlFocusTab } from '@/components/Domain/crawlResults/focus/CrawlFocusTab';
import { readManualTopic, writeManualTopic } from '@/services/siteFocusMonitoring';
import { createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';
import { diabetesSite } from './siteFocusFixtures';

vi.mock('@/services/desktopNotifications/delivery', () => ({ sendProjectNotification: vi.fn().mockResolvedValue(false) }));
vi.mock('@/components/Domain/crawlResults/focus/benchmark/FocusBenchmarkSection', () => ({
  FocusBenchmarkSection: ({ onCompetitorTerms }: { onCompetitorTerms?: (terms: string[]) => void }) => (
    <button type="button" onClick={() => onCompetitorTerms?.(['zzcompetitorterm'])}>apply-competitor</button>
  ),
}));

const pages = diabetesSite('diabetes.test');
const START = 'https://diabetes.test/';
const makeRun = (id: string) => createCrawlRunFixture({ id, startUrl: START, result: createCrawlResultFixture({ pages }) });
const openMeta = () => fireEvent.click(screen.getByRole('button', { name: 'Analysis details' }));

beforeEach(async () => { localStorage.clear(); await i18n.changeLanguage('en'); });

describe('CrawlFocusTab wiring', () => {
  it('persists the manual topic and restores it on remount', async () => {
    const view = render(<CrawlFocusTab pages={pages} startUrl={START} run={makeRun('r1')} projectId="p1" />);
    fireEvent.click(screen.getByRole('button', { name: /wrong/i }));
    fireEvent.change(screen.getByLabelText(/Your topic/), { target: { value: 'diabetes' } });
    await act(async () => {});
    expect(readManualTopic('p1')).toBe('diabetes');
    view.unmount();
    render(<CrawlFocusTab pages={pages} startUrl={START} run={makeRun('r1')} projectId="p1" />);
    expect((screen.getByLabelText(/Your topic/) as HTMLInputElement).value).toBe('diabetes');
    fireEvent.click(screen.getByRole('button', { name: /reset|auto/i }));
    await act(async () => {});
    expect(readManualTopic('p1')).toBeUndefined();
  });

  it('restores array topics as comma list', () => {
    writeManualTopic('p1', ['diabetes', 'insulin']);
    render(<CrawlFocusTab pages={pages} startUrl={START} run={makeRun('r1')} projectId="p1" />);
    expect((screen.getByLabelText(/Your topic/) as HTMLInputElement).value).toBe('diabetes, insulin');
  });

  it('recalculates within the daily budget and disables when exhausted', () => {
    render(<CrawlFocusTab pages={pages} startUrl={START} run={makeRun('r1')} projectId="p1" />);
    openMeta();
    expect(screen.getByText('3 of 3 full recalculations left today.')).toBeTruthy();
    for (let i = 0; i < 3; i += 1) fireEvent.click(screen.getByRole('button', { name: 'Recalculate' }));
    expect(screen.getByText(/Daily limit of 3/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Recalculate' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows history chart, weekly summary and competitor gaps (clearable)', () => {
    const { rerender } = render(<CrawlFocusTab pages={pages} startUrl={START} run={makeRun('r1')} projectId="p1" />);
    expect(screen.getByText('Run at least two full analyses to see the trend.')).toBeTruthy();
    expect(screen.getByText('Weekly summary')).toBeTruthy();
    expect(screen.getByText(/first analysis/)).toBeTruthy();
    openMeta();
    fireEvent.click(screen.getByRole('button', { name: 'Recalculate' }));
    expect(screen.getByRole('img', { name: /over 2 analyses/ })).toBeTruthy();
    expect(screen.getByText(/since the previous analysis/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'apply-competitor' }));
    expect(screen.getByText('Topic Cluster Gap Analysis uses 1 competitor terms.')).toBeTruthy();
    expect(screen.getAllByText(/zzcompetitorterm/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Clear competitor terms' }));
    expect(screen.queryByText(/competitor terms\./)).toBeNull();
    rerender(<CrawlFocusTab pages={pages} startUrl={START} run={makeRun('r1')} projectId="p1" />);
  });

  it('falls back to local computation without run and recalculates freely', () => {
    render(<CrawlFocusTab pages={pages} startUrl={START} />);
    openMeta();
    expect(screen.queryByText(/full recalculations left/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Recalculate' }));
    expect(screen.getByTestId('focus-score')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'apply-competitor' })).toBeTruthy();
  });
});
