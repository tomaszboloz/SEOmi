import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CrawlComparisonSelector } from '@/components/Domain/siteAudit/CrawlComparisonSelector';
import type { useSiteAuditSession } from '@/components/Domain/siteAudit/useSiteAuditSession';

type Session = ReturnType<typeof useSiteAuditSession>;

const session = {
  comparisonByPath: false,
  comparisonRunId: '',
  crawlEnvironmentLabel: () => 'Default',
  crawlRuns: [{ id: 'bad', completedAt: 'invalid', startUrl: 'https://example.test/', result: { pages_crawled: 1 } }],
  selectedRun: undefined,
  setComparisonRunId: () => undefined,
  t: (key: string) => key,
  updateComparisonByPath: () => undefined,
} as unknown as Session;

describe('CrawlComparisonSelector', () => {
  it('keeps an invalid completion timestamp selectable without throwing', () => {
    render(<CrawlComparisonSelector session={session} />);
    expect(screen.getByRole('option', { name: /—/ })).toBeTruthy();
  });
});
