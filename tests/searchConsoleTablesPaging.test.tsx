import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SearchConsoleTables } from '@/components/AgentWorkflows/searchConsole/Tables';
import type { SearchConsoleSession } from '@/components/AgentWorkflows/searchConsole/useSearchConsoleSession';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, o?: Record<string, unknown>) => (o ? `${key}:${JSON.stringify(o)}` : key) }),
}));

const queries = Array.from({ length: 60 }, (_, i) => ({ query: `phrase ${String(i).padStart(2, '0')}`, clicks: i, impressions: 1000 - i, ctr: 1, position: i + 1 }));
const session = { t: (key: string) => key, gscData: { queries, pages: [{ page: 'https://a.test/', clicks: 5, impressions: 50, ctr: 10, position: 2 }] } } as unknown as SearchConsoleSession;

const firstQueryTable = () => screen.getAllByRole('table')[0];
const firstBodyCell = () => within(firstQueryTable()).getAllByRole('row')[1].querySelector('td')?.textContent;

describe('Search Console tables', () => {
  it('shows every phrase across pages instead of one unbounded list', () => {
    render(<SearchConsoleTables session={session} />);
    expect(within(firstQueryTable()).getAllByRole('row')).toHaveLength(26);
    expect(screen.getAllByText(/searchConsole.showingRows/)[0].textContent).toContain('"total":60');
    fireEvent.click(screen.getAllByText('searchConsole.pageNext')[0]);
    expect(screen.getAllByText(/searchConsole.pageOf/)[0].textContent).toContain('"page":2');
    fireEvent.click(screen.getAllByText('searchConsole.pageNext')[0]);
    expect(within(firstQueryTable()).getAllByRole('row')).toHaveLength(11);
    expect((screen.getAllByText('searchConsole.pageNext')[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it('sorts by clicks descending first and toggles direction or column on header clicks', () => {
    render(<SearchConsoleTables session={session} />);
    expect(firstBodyCell()).toBe('phrase 59');
    fireEvent.click(within(firstQueryTable()).getAllByRole('button')[1]);
    expect(firstBodyCell()).toBe('phrase 00');
    fireEvent.click(within(firstQueryTable()).getAllByRole('button')[0]);
    expect(firstBodyCell()).toBe('phrase 00');
    fireEvent.click(within(firstQueryTable()).getAllByRole('button')[0]);
    expect(firstBodyCell()).toBe('phrase 59');
  });

  it('changes page size, returns to page one and clamps previous at the start', () => {
    render(<SearchConsoleTables session={session} />);
    fireEvent.click(screen.getAllByText('searchConsole.pageNext')[0]);
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '100' } });
    expect(within(firstQueryTable()).getAllByRole('row')).toHaveLength(61);
    expect((screen.getAllByText('searchConsole.pagePrevious')[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders the empty labels when there are no rows', () => {
    render(<SearchConsoleTables session={{ t: (k: string) => k, gscData: { queries: [], pages: [] } } as unknown as SearchConsoleSession} />);
    expect(screen.getByText('searchConsole.noQueryRows')).toBeTruthy();
    expect(screen.getByText('searchConsole.noPageRows')).toBeTruthy();
  });
});
