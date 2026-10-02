import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { CrawlRobotsSummaryRows } from '@/components/Domain/crawlResults/CrawlRobotsSummaryRows';
import type { useCrawlResultsSession } from '@/components/Domain/crawlResults/useCrawlResultsSession';

type Session = ReturnType<typeof useCrawlResultsSession>;
const t = (key: string, options?: Record<string, unknown>) => (options ? `${key}:${JSON.stringify(options)}` : key);
const rows = (result: Record<string, unknown>) => render(<table><tbody><CrawlRobotsSummaryRows session={{ result, t } as unknown as Session} /></tbody></table>);

it('marks robots evidence missing for older runs', () => {
  rows({ robots_txt_status: 'ok', robots_blocked_count: 0 });
  expect(screen.getByText('crawl.ui.noDataOlderRun')).toBeTruthy();
  expect(screen.getByText('crawl.ui.noRulesOlderRun')).toBeTruthy();
  expect(screen.getByText('crawl.ui.noDeclarationsOlderRun')).toBeTruthy();
  expect(screen.getAllByRole('row')).toHaveLength(4);
});

it('lists applicable rules, bounded per-agent rules and sitemap declarations', () => {
  const rules = Array.from({ length: 14 }, (_, index) => ({ directive: 'disallow', path: `/p${index}` }));
  rows({ robots_txt_status: 'ok', robots_blocked_count: 2, robots_user_agent: 'SEOmiBot',
    robots_applicable_rules: [{ directive: 'allow', path: '/' }],
    robots_agent_matrix: [{ user_agent: 'Googlebot', applicable_rules: rules, specific_group: true, crawl_delay_ms: 500 }],
    robots_sitemap_directives: ['https://a.test/sitemap.xml'] });
  expect(screen.getByText('crawl.ui.robotsSummary:{"status":"ok","blocked":2}')).toBeTruthy();
  expect(screen.getByText('SEOmiBot')).toBeTruthy();
  expect(screen.getByText('ALLOW: /')).toBeTruthy();
  expect(screen.getByText('Googlebot')).toBeTruthy();
  expect(screen.getByText('+2')).toBeTruthy();
  expect(screen.getByText('https://a.test/sitemap.xml')).toBeTruthy();
  expect(screen.getAllByRole('row')).toHaveLength(5);
});
