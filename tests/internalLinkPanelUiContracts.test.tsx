import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InternalLinkOpportunitiesPanel } from '@/components/Charts/InternalLinkOpportunitiesPanel';
import { findInternalLinkOpportunities } from '@/services/internalLinkOpportunities';
import { createCrawlPageFixture as page } from './fixtures/crawl';
import i18n from '@/i18n';

const label = (key: string, values?: Record<string, unknown>) => i18n.t(`componentUi.${key}`, values);
const eligible = (url: string, title: string) => page({ url, final_url: url, title, semantic_terms: ['solar', 'panel', 'guide'], semantic_links: [] });

describe('internal link opportunity presentation', () => {
  it('renders directed measured candidates and searches across title, URLs and shared terms', () => {
    const pages = [eligible('https://site.test/alpha', 'Alpha'), eligible('https://site.test/beta?category=energy', 'Beta')];
    const report = findInternalLinkOpportunities(pages);
    expect(report.opportunities).toHaveLength(2);
    const view = render(<InternalLinkOpportunitiesPanel pages={pages} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href')).sort())
      .toEqual(pages.flatMap((item) => [item.url, item.url]).sort());
    expect(view.container.textContent).toContain('site.test/beta?category=energy');
    expect(screen.getAllByText(label('weightedHeuristic', { score: '100' }))).toHaveLength(2);
    for (const query of ['  SOLAR  ', 'alpha', 'category=energy']) {
      fireEvent.change(screen.getByLabelText(label('filterCandidatesAria')), { target: { value: query } });
      expect(screen.getAllByRole('listitem')).toHaveLength(2);
    }
    fireEvent.change(screen.getByLabelText(label('filterCandidatesAria')), { target: { value: 'absent' } });
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByText(label('noCandidates'))).toBeTruthy();
  });

  it('discloses unavailable/incomplete source evidence and keeps a complete no-candidate result distinct', () => {
    const view = render(<InternalLinkOpportunitiesPanel pages={[]} />);
    expect(screen.getByText(label('noCompletePages'))).toBeTruthy();
    view.rerender(<InternalLinkOpportunitiesPanel pages={[page({ body_truncated: true })]} />);
    expect(screen.getByRole('status').textContent).toContain(label('noCompletePages').toLocaleLowerCase());
    view.rerender(<InternalLinkOpportunitiesPanel pages={[eligible('https://site.test/one', 'One')]} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText(label('noCandidates'))).toBeTruthy();
  });

  it('falls back to raw string when page URL is not a valid URL', async () => {
    const linkOps = await import('@/services/internalLinkOpportunities');
    const spy = vi.spyOn(linkOps, 'findInternalLinkOpportunities').mockReturnValueOnce({
      opportunities: [
        {
          id: '1',
          sourceUrl: 'invalid-url-1',
          sourceTitle: 'Source Title',
          targetUrl: 'invalid-url-2',
          targetTitle: 'Target Title',
          sharedTerms: ['seo'],
          weightedJaccard: 0.5,
        },
      ],
      eligiblePageCount: 2,
      pagesWithoutCompleteEvidence: 0,
      pagesOmittedByLimit: 0,
      resultsLimited: false,
    });
    const view = render(<InternalLinkOpportunitiesPanel pages={[]} />);
    expect(view.container.textContent).toContain('invalid-url-1');
    spy.mockRestore();
  });
});
