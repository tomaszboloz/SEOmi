import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { cruxCategory, formatCruxValue } from '@/components/Performance/cruxEvidence';
import { SearchConsoleTables } from '@/components/AgentWorkflows/searchConsole/Tables';
import type { SearchConsoleSession } from '@/components/AgentWorkflows/searchConsole/useSearchConsoleSession';

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (key: string, values?: Record<string, unknown>) => values ? `${key}:${JSON.stringify(values)}` : key }),
}));

const t = (key: string) => key;

describe('CrUX value and category boundaries', () => {
  it('formats valid CLS and timing measurements and selects every rating band', () => {
    expect(formatCruxValue({ metric: 'cumulative_layout_shift', percentiles: { p75: '0.125' } }, t)).toBe('0.125');
    expect(formatCruxValue({ metric: 'largest_contentful_paint', percentiles: { p75: 2499.6 } }, t)).toBe('2500 pageSpeedUi.ms');
    expect(cruxCategory({ metric: 'largest_contentful_paint', percentiles: { p75: 2500 } }, t)).toBe('pageSpeedUi.crux.good');
    expect(cruxCategory({ metric: 'largest_contentful_paint', percentiles: { p75: 2501 } }, t)).toBe('pageSpeedUi.crux.needsImprovement');
    expect(cruxCategory({ metric: 'largest_contentful_paint', percentiles: { p75: 4001 } }, t)).toBe('pageSpeedUi.crux.poor');
    expect(cruxCategory({ metric: 'unknown', percentiles: { p75: 1 } }, t)).toBe('pageSpeedUi.crux.unrated');
  });
});

const queries = Array.from({ length: 60 }, (_, i) => ({ query: `q${i}`, clicks: i, impressions: i, ctr: i, position: i }));
const session = (gscData: unknown) => ({ t: (key: string) => key, gscData } as unknown as SearchConsoleSession);

describe('Search Console table boundary controls', () => {
  it('moves backward after paging forward and accepts an absent data payload', () => {
    const view = render(<SearchConsoleTables session={session({ queries, pages: [{ page: 'https://example.test/', clicks: 1, impressions: 2, ctr: 3, position: 4 }, { page: 'https://example.test/b', clicks: 2, impressions: 1, ctr: 1, position: 2 }] })} />);
    const table = () => screen.getAllByRole('table')[0];
    fireEvent.click(screen.getAllByRole('button', { name: 'searchConsole.pageNext' })[0]);
    expect(within(table()).getByText('q34')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'searchConsole.pagePrevious' })[0]);
    expect(within(table()).getByText('q59')).toBeTruthy();
    for (const button of within(table()).getAllByRole('button').slice(2)) fireEvent.click(button);
    for (const button of within(screen.getAllByRole('table')[1]).getAllByRole('button')) fireEvent.click(button);
    view.unmount();
    render(<SearchConsoleTables session={session(undefined)} />);
    expect(screen.getByText('searchConsole.noQueryRows')).toBeTruthy();
  });
});
