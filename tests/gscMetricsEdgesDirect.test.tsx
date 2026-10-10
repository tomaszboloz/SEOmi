import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SearchConsoleMetrics } from '@/components/AgentWorkflows/searchConsole/Metrics';
import type { SearchConsoleSession } from '@/components/AgentWorkflows/searchConsole/useSearchConsoleSession';
import { gscData } from './fixtures/gscTracker';
import i18n from '@/i18n';

const t = (key: string, values?: Record<string, unknown>) => values ? `${key}:${Object.values(values).join('|')}` : key;
void i18n;
const state = (data: ReturnType<typeof gscData> | null): SearchConsoleSession => ({ t, gscData: data } as unknown as SearchConsoleSession);

describe('Search Console metrics direct edges', () => {
  it('renders all four trends and distinguishes truncated analytics', () => {
    const data = gscData({
      daily: [
        { date: '2026-09-01', clicks: 2, impressions: 20, ctr: 0.1, position: 9 },
        { date: '2026-09-02', clicks: 3, impressions: 30, ctr: 0.1, position: 8 },
      ], daily_may_be_truncated: true, queries_may_be_truncated: true, pages_may_be_truncated: false,
    });
    render(<SearchConsoleMetrics session={state(data)} />);
    expect(screen.getAllByRole('img')).toHaveLength(4);
    expect(screen.getAllByRole('note')[0]?.textContent).toContain('searchConsole.trendTruncated');
    expect(screen.getAllByRole('note')[1]?.textContent).toContain('searchConsole.analyticsTruncated');
    expect(screen.getAllByText('searchConsole.days:2')).toHaveLength(4);
  });

  it('renders the no-data card state and the untruncated or page-truncated alternatives', () => {
    const view = render(<SearchConsoleMetrics session={state(null)} />);
    expect(screen.getByText('searchConsole.completeDays')).toBeTruthy();
    view.rerender(<SearchConsoleMetrics session={state(gscData({ daily: [], queries_may_be_truncated: false, pages_may_be_truncated: false }))} />);
    expect(screen.getByText('searchConsole.tooFewPoints')).toBeTruthy();
    expect(screen.getByRole('note').textContent).not.toContain('searchConsole.analyticsTruncated');
    view.rerender(<SearchConsoleMetrics session={state(gscData({ daily: [], queries_may_be_truncated: false, pages_may_be_truncated: true }))} />);
    expect(screen.getByRole('note').textContent).toContain('searchConsole.analyticsTruncated');
    view.rerender(<SearchConsoleMetrics session={state(null)} />);
    expect(screen.queryByText('searchConsole.tooFewPoints')).toBeNull();
  });
});
