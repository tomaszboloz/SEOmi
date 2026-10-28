import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { GscOpportunities } from '@/components/AgentWorkflows/GscOpportunities';
import { snapshotGscPerformance } from '@/services/gscPerformanceTracker';
import { gscData } from './fixtures/gscTracker';
import i18n from '@/i18n';

const queries = Array.from({ length: 301 }, (_, index) => ({
  query: `word-${index}`, position: 12, clicks: 1, impressions: 100 + index, ctr: 1,
}));
const data = gscData({ queries });
const snapshot = snapshotGscPerformance(data);
beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(() => cleanup());

describe('all live GSC queries', () => {
  it('paginates beyond both the old 20-row UI cut and the 250-row history cap', () => {
    render(<GscOpportunities snapshot={snapshot} data={data} />);
    expect(screen.getByText('Showing 1–20 of 301')).toBeTruthy();
    expect(screen.queryByRole('note')).toBeNull();
    fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '100' } });
    for (let index = 0; index < 3; index++) fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('word-300')).toBeTruthy();
    expect(screen.getByText('Showing 301–301 of 301')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '20' } });
    expect(screen.getByText('Showing 1–20 of 301')).toBeTruthy();
  });

  it('finds a live phrase absent from the stored snapshot and clears the filter', () => {
    render(<GscOpportunities snapshot={snapshot} data={data} />);
    fireEvent.change(screen.getByLabelText('Filter queries'), { target: { value: 'WORD-300' } });
    expect(screen.getByText('word-300')).toBeTruthy();
    expect(screen.getByText('Showing 1–1 of 1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear text filter' }));
    expect(screen.getByText('Showing 1–20 of 301')).toBeTruthy();
  });

  it('sorts the full live set and exposes the active direction', () => {
    render(<GscOpportunities snapshot={snapshot} data={data} />);
    const heading = screen.getByRole('columnheader', { name: 'Impressions' });
    fireEvent.click(within(heading).getByRole('button'));
    expect(heading.getAttribute('aria-sort')).toBe('descending');
    expect(within(screen.getAllByRole('row')[1]).getByText('word-300')).toBeTruthy();
    fireEvent.click(within(heading).getByRole('button'));
    expect(heading.getAttribute('aria-sort')).toBe('ascending');
    expect(within(screen.getAllByRole('row')[1]).getByText('word-0')).toBeTruthy();
  });

  it('treats metacharacters literally and announces an empty substring result', () => {
    const special = gscData({ queries: [
      { ...queries[0], query: 'Brand [A+] café' }, { ...queries[0], query: 'Brand AAAAA cafe' },
    ] });
    render(<GscOpportunities snapshot={snapshotGscPerformance(special)} data={special} />);
    const input = screen.getByLabelText('Filter queries');
    fireEvent.change(input, { target: { value: '[a+]' } });
    expect(screen.getByText('Brand [A+] café')).toBeTruthy();
    expect(screen.queryByText('Brand AAAAA cafe')).toBeNull();
    fireEvent.change(input, { target: { value: 'not present' } });
    expect(screen.getByText('No queries contain this text.')).toBeTruthy();
  });

  it('supports keyboard view selection and updates after a new live report', () => {
    const view = render(<GscOpportunities snapshot={snapshot} data={data} />);
    const first = screen.getByRole('tab', { name: 'All queries (301)' });
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: /Queries 10–20/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(document.activeElement?.id);
    const fresh = gscData({ queries: [{ ...queries[0], query: 'fresh-data' }] });
    view.rerender(<GscOpportunities snapshot={snapshotGscPerformance(fresh)} data={fresh} />);
    expect(screen.getByText('fresh-data')).toBeTruthy();
    expect(screen.getByText('Showing 1–1 of 1')).toBeTruthy();
  });
});
