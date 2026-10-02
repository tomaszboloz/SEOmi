import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { CrawlRunComparison } from '@/components/Domain/crawlResults/CrawlRunComparison';
import type { useCrawlResultsSession } from '@/components/Domain/crawlResults/useCrawlResultsSession';

type Session = ReturnType<typeof useCrawlResultsSession>;
const run = (id: string, startUrl: string) => ({ id, startUrl, completedAt: '2026-10-01T08:30:00', result: { pages_crawled: 3 } });
const session = (overrides: Record<string, unknown>) => ({
  compareByPath: false, comparison: null, comparisonRunId: '', currentRun: run('current', 'https://a.test/'),
  runs: [run('current', 'https://a.test/'), run('base', 'https://staging.a.test/')],
  setComparisonRunId: vi.fn(), updateCompareByPath: vi.fn(), t: (key: string) => key, ...overrides,
}) as unknown as Session;

it('renders nothing without a second saved run', () => {
  const view = render(<CrawlRunComparison session={session({ runs: [run('current', 'https://a.test/')] })} />);
  expect(view.container.textContent).toBe('');
});

it('offers only other runs as a base and routes selection and path matching', () => {
  const value = session({});
  render(<CrawlRunComparison session={value} />);
  const options = screen.getAllByRole('option').map(option => option.getAttribute('value'));
  expect(options).toEqual(['', 'base']);
  fireEvent.change(screen.getByRole('combobox', { name: 'crawl.ui.compareCrawl' }), { target: { value: 'base' } });
  fireEvent.click(screen.getByRole('checkbox'));
  expect(value.setComparisonRunId).toHaveBeenCalledExactlyOnceWith('base');
  expect(value.updateCompareByPath).toHaveBeenCalledExactlyOnceWith(true);
  expect(screen.getByText('crawlDeepUi.fullUrlDescription')).toBeTruthy();
});

it('summarizes path-matched changes and shows the empty-change state', () => {
  const comparison = { added: [{ kind: 'added', url: 'https://a.test/new', fields: [] }], removed: [],
    changed: [{ kind: 'changed', url: 'https://a.test/x', matchedUrl: 'https://staging.a.test/x', fields: ['title', 'status'] }] };
  const view = render(<CrawlRunComparison session={session({ compareByPath: true, comparison })} />);
  expect(screen.getByRole('note').textContent).toBe('crawlDeepUi.pathMatchDisclaimer');
  expect(screen.getByText('changed · https://a.test/x ↔ https://staging.a.test/x (title, status)')).toBeTruthy();
  expect(screen.getByText('added · https://a.test/new')).toBeTruthy();
  view.rerender(<CrawlRunComparison session={session({ comparison: { added: [], removed: [], changed: [] } })} />);
  expect(screen.getByText('crawlDeepUi.noComparisonChanges')).toBeTruthy();
});
