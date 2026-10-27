import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { GscOpportunities } from '@/components/AgentWorkflows/GscOpportunities';
import { snapshotGscPerformance } from '@/services/gscPerformanceTracker';
import { gscData } from './fixtures/gscTracker';

const row = (query: string, index: number) => ({ query, clicks: index + 1, impressions: 100 + index, ctr: 1, position: 8 });
const snap = (queries: ReturnType<typeof row>[]) => snapshotGscPerformance(gscData({ queries }));

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(() => cleanup());

describe('GSC opportunities browser table', () => {
  it('keeps the complete snapshot and reaches rows after the first page', () => {
    render(<GscOpportunities snapshot={snap(Array.from({ length: 25 }, (_, index) => row(`q-${index}`, index)))} />);
    expect(screen.getByText('q-0')).toBeDefined();
    expect(screen.queryByText('q-24')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('q-24')).toBeDefined();
    expect(screen.getByText('Showing 21–25 of 25')).toBeDefined();
  });

  it('filters literal NFC-normalized substrings and clears back to all rows', () => {
    render(<GscOpportunities snapshot={snap([row('Café+SEO', 1), row('other', 2)])} />);
    const input = screen.getByLabelText('Filter queries');
    fireEvent.change(input, { target: { value: 'cafe\u0301+' } });
    expect(screen.getByText('Café+SEO')).toBeDefined();
    expect(screen.queryByText('other')).toBeNull();
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByText('other')).toBeDefined();
  });

  it('sorts numeric columns and resets the page after a view change or new snapshot', () => {
    const first = snap(Array.from({ length: 25 }, (_, index) => row(`q-${index}`, index)));
    const view = render(<GscOpportunities snapshot={first} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clicks' }));
    const firstVisible = within(screen.getAllByRole('row')[1]).getByText('q-24');
    expect(firstVisible).toBeDefined();
    fireEvent.click(screen.getByRole('tab', { name: /Queries 10–20/ }));
    expect(screen.getByText('Showing 0–0 of 0')).toBeDefined();
    view.rerender(<GscOpportunities snapshot={snap([{ ...row('fresh', 1), position: 12 }])} />);
    expect(screen.getByText('fresh')).toBeDefined();
  });
});
