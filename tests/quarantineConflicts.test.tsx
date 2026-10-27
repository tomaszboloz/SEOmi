import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InternalLinkOpportunitiesPanel } from '@/components/Charts/InternalLinkOpportunitiesPanel';
import { QuarantineConflicts } from '@/components/Charts/QuarantineConflicts';
import { createCrawlPageFixture as page } from './fixtures/crawl';
import '@/i18n';
import type { QuarantineEntry } from '@/services/recommendationBus';

const eligible = (url: string) => page({ url, final_url: url, title: url, semantic_terms: ['solar', 'panel', 'guide'], semantic_links: [] });
const entries: QuarantineEntry[] = [
  { url: 'https://s.test/b', reason: 'remove', quarantined: true, source: 'site-focus' },
  { url: 'https://s.test/c', reason: 'redirect', quarantined: true, source: 'topical-authority', target: 'https://s.test/a' },
];

describe('quarantine conflicts UI', () => {
  it('renders nothing without data', () => {
    const view = render(<QuarantineConflicts quarantine={[]} />);
    expect(view.container.innerHTML).toBe('');
  });

  it('lists quarantined URLs, redirect targets and conflicts', () => {
    render(<QuarantineConflicts quarantine={entries} conflicts={[{ kind: 'protected-by-evidence', url: 'https://s.test/r' }]} droppedCount={2} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText(/s\.test\/c → https:\/\/s\.test\/a/)).toBeTruthy();
  });

  it('panel never offers a quarantined URL as link target', () => {
    const pages = ['a', 'b', 'c', 'd', 'e'].map((n) => eligible(`https://s.test/${n}`));
    render(<InternalLinkOpportunitiesPanel pages={pages} quarantine={entries} />);
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs.length).toBeGreaterThan(0);
    expect(hrefs.some((href) => href === 'https://s.test/b' || href === 'https://s.test/c')).toBe(false);
  });
});
