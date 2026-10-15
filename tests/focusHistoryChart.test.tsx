import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { FocusHistoryChart } from '@/components/Domain/crawlResults/focus/FocusHistoryChart';
import { WeeklySummaryCard } from '@/components/Domain/crawlResults/focus/WeeklySummaryCard';
import type { HistorySeries } from '@/services/siteFocusMonitoring';

const point = (runId: string, score: number) => ({ runId, at: '2026-01-01T00:00:00Z', score, pageCount: 5, delta: null });
const series: HistorySeries = {
  points: [point('a', 80), point('b', 60), point('c', 120)],
  markers: [
    { runId: 'b', at: '2026-01-02T00:00:00Z', score: 60, code: 'removed-offtopic', params: { count: 2 }, delta: -20 },
    { runId: 'c', at: '2026-01-03T00:00:00Z', score: 100, code: 'new-cluster', params: { label: 'x', count: 1 }, delta: 5 },
  ],
};

afterEach(async () => { await i18n.changeLanguage('en'); });

describe('FocusHistoryChart', () => {
  it('shows the empty state below two snapshots', () => {
    render(<FocusHistoryChart series={{ points: [point('a', 50)], markers: [] }} />);
    expect(screen.getByText('Run at least two full analyses to see the trend.')).toBeTruthy();
  });
  it('renders accessible chart with annotations (LTR and RTL)', async () => {
    const { container, rerender } = render(<FocusHistoryChart series={series} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('3 analyses');
    expect(screen.getByText(/Removed 2 off-topic pages \(-20 points\)/)).toBeTruthy();
    const ltr = container.querySelector('polyline')?.getAttribute('points');
    await i18n.changeLanguage('ar');
    rerender(<FocusHistoryChart series={series} />);
    expect(container.querySelector('polyline')?.getAttribute('points')).not.toBe(ltr);
  });
});

describe('WeeklySummaryCard', () => {
  it('renders tasks and the empty state', () => {
    const task = { code: 'remove-offtopic' as const, params: { count: 2, gain: 3 }, deltaScore: 3, effort: { minHours: 1, maxHours: 2, estimate: true as const }, ratio: 1, urls: [] };
    const { rerender } = render(<WeeklySummaryCard weekly={{ score: 70, delta: 4, tasks: [task] }} />);
    expect(screen.getByText(/\+4/)).toBeTruthy();
    expect(screen.getByText(/\(\+3 pts\)/)).toBeTruthy();
    rerender(<WeeklySummaryCard weekly={{ score: 70, delta: -2, tasks: [] }} />);
    expect(screen.getByText('No urgent tasks.')).toBeTruthy();
  });
});
