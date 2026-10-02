import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { GscOpportunities } from '@/components/AgentWorkflows/GscOpportunities';
import { snapshotGscPerformance } from '@/services/gscPerformanceTracker';
import { gscData } from './fixtures/gscTracker';
import i18n from '@/i18n';
afterEach(async () => { cleanup(); await i18n.changeLanguage('en'); });
it('renders empty evidence and the honest AI Overview availability notice', () => {
  render(<GscOpportunities snapshot={snapshotGscPerformance(gscData({ queries: [] }))} />);
  expect(screen.getAllByText('No rows meet the evidence thresholds.')).toHaveLength(2);
  expect(screen.getByText(/cannot separate their metrics/)).toBeDefined();
  expect(screen.getByRole('link').getAttribute('rel')).toBe('noopener noreferrer');
});
it('renders actual opportunities, weighted CTR and truncation in Polish', async () => {
  await i18n.changeLanguage('pl');
  const queries = [
    { query: 'near', position: 12, clicks: 10, impressions: 100, ctr: 10 },
    ...['low', 'a', 'b', 'c'].map((query, i) => ({ query, position: 5,
      clicks: i ? 20 : 1, impressions: 100, ctr: i ? 20 : 1 })),
  ];
  render(<GscOpportunities snapshot={snapshotGscPerformance(gscData({ queries, queries_may_be_truncated: true }))} />);
  expect(screen.getByText(/near · #12.0/)).toBeDefined();
  expect(screen.getByText(/low · CTR 1.0%/)).toBeDefined();
  expect(screen.getByRole('note')).toBeDefined();
  expect(screen.getByText(/nie pozwala wydzielić/)).toBeDefined();
});
