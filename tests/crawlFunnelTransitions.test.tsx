import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import '@/i18n';
import { CrawlFunnelTransitions } from '@/components/Domain/crawlResults/linksTab/CrawlFunnelTransitions';
import type { FunnelPageInput } from '@/services/sija/funnelTransitions';

const none = { tables: 0, ordered_lists: 0, unordered_lists: 0, interactive_inputs: 0 };
const page = (url: string, title: string, dom: FunnelPageInput['dom_structure'], to?: string): FunnelPageInput => ({
  url, final_url: url, title, word_count: 400, heading_counts: [1, 3], dom_structure: dom,
  semantic_links: to ? [{ target_url: to, anchor_text: 'a', is_internal: true }] : [],
});

it('renders a stage matrix with counts and the skipped summary', () => {
  render(<CrawlFunnelTransitions pages={[
    page('https://a.test/how', 'How to bake', { ...none, ordered_lists: 1 }, 'https://a.test/cmp'),
    page('https://a.test/cmp', 'A vs B', { ...none, tables: 1 }),
  ]} />);
  const section = screen.getByTestId('crawl-funnel-transitions');
  expect(section.querySelectorAll('tbody tr')).toHaveLength(3);
  expect(section.textContent).toContain('2 pages classified');
});

it('renders nothing when no page has measured structure', () => {
  render(<CrawlFunnelTransitions pages={[page('https://a.test/', 'Hi', undefined)]} />);
  expect(screen.queryByTestId('crawl-funnel-transitions')).toBeNull();
});
