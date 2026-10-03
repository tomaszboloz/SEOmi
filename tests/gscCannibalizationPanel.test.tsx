import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GscCannibalization } from '@/components/AgentWorkflows/GscCannibalization';
import { snapshotGscPerformance } from '@/services/gscTracker/snapshot';
import { gscData } from './fixtures/gscTracker';
import i18n from '@/i18n';
afterEach(async () => { cleanup(); await i18n.changeLanguage('en'); });

it('distinguishes unavailable, measured-empty and invalid observations', () => {
  const { rerender } = render(<GscCannibalization data={snapshotGscPerformance(gscData())} />);
  expect(screen.getByText('This report has no observed query/page pairs. Refresh Search Console data.')).toBeDefined();
  rerender(<GscCannibalization data={snapshotGscPerformance(gscData({ query_pages: [] }))} />);
  expect(screen.getByText('No query has two URLs meeting the evidence thresholds.')).toBeDefined();
  rerender(<GscCannibalization data={snapshotGscPerformance(gscData({ query_pages: [{ query: 'q', page: 'javascript:x', clicks: 0, impressions: 20, ctr: 0, position: 1 }] }))} />);
  expect(screen.getByRole('alert').textContent).toContain('Invalid joint observations');
});
it('shows observed metrics, honest truncation and a candidate-only notice in Polish', async () => {
  await i18n.changeLanguage('pl');
  const pairs = ['a', 'b'].map(page => ({ query: 'seo', page: `https://example.com/${page}`, clicks: 0, impressions: 30, ctr: 0, position: 12 }));
  render(<GscCannibalization data={snapshotGscPerformance(gscData({ query_pages: pairs, query_pages_may_be_truncated: true }))} />);
  expect(screen.getByText('seo')).toBeDefined();
  expect(screen.getAllByRole('link')).toHaveLength(2);
  expect(screen.getAllByRole('link')[0].getAttribute('rel')).toBe('noopener noreferrer');
  expect(screen.getByRole('note').textContent).toContain('obcięte');
  expect(screen.getByText(/To sygnał do weryfikacji/)).toBeDefined();
  expect(screen.getAllByText(/50.0%/)).toHaveLength(2);
});
it('paginates every candidate and clamps pagination after the report becomes smaller', () => {
  const pairs = Array.from({ length: 21 }, (_, i) => ['a', 'b'].map(page => ({ query: `q${i}`, page: `https://example.com/${page}`, clicks: 1, impressions: 50, ctr: 2, position: 5 }))).flat();
  const { rerender } = render(<GscCannibalization data={snapshotGscPerformance(gscData({ query_pages: pairs }))} />);
  expect(screen.getAllByRole('link')).toHaveLength(40);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getAllByRole('link')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
  expect(screen.getAllByRole('link')).toHaveLength(40);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  rerender(<GscCannibalization data={snapshotGscPerformance(gscData({ query_pages: pairs.slice(0, 2) }))} />);
  expect(screen.getAllByRole('link')).toHaveLength(2);
  expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
});
