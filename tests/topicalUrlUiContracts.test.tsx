import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TopicalUrlAssignments } from '@/components/Charts/semanticTopical/TopicalUrlAssignments';
import { topicalSession } from './fixtures/topicalSessionContracts';

const candidates = [
  { url: 'https://site.test/crawl', source: 'crawl' as const, title: 'Crawled page' },
  { url: 'https://site.test/link', source: 'content-link' as const, title: 'Anchor text' },
  { url: 'https://site.test/map', source: 'sitemap' as const, title: '' },
  { url: 'https://site.test/saved', source: 'saved' as const, title: '' },
];

describe('topical URL assignment public contracts', () => {
  it('renders only for a selected node and communicates missing candidates', () => {
    const session = topicalSession({ selectedNode: null });
    const { container, rerender } = render(<TopicalUrlAssignments session={session} />);
    expect(container.textContent).toBe('');
    rerender(<TopicalUrlAssignments session={topicalSession()} />);
    expect(screen.getByText('semanticWorkspace.noUrlCandidates')).toBeTruthy();
    expect(screen.getByText('semanticWorkspace.currentRunCount:0')).toBeTruthy();
  });
  it('shows source provenance, searches and updates exact selected URL identities', () => {
    const session = topicalSession({ availableUrlCandidates: candidates, matchingUrlCandidates: candidates });
    session.selectedNode!.sourceUrls = ['https://site.test/crawl#section', 'invalid'];
    session.crawledUrls = new Set(['https://site.test/crawl']);
    render(<TopicalUrlAssignments session={session} />);
    expect(screen.getByText('semanticWorkspace.currentRunCount:1')).toBeTruthy();
    for (const source of ['sourceCrawl', 'sourceContentLink', 'sourceSitemap', 'sourceSaved']) expect(screen.getByText(`semanticWorkspace.${source}`)).toBeTruthy();
    expect(screen.getByText('semanticWorkspace.linkText:Anchor text')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'map' } });
    expect(session.setPageSearch).toHaveBeenCalledWith('map');
    const buttons = screen.getAllByRole('checkbox');
    expect((buttons[0] as HTMLInputElement).checked).toBe(true);
    fireEvent.click(buttons[0]);
    expect(session.updateNode).toHaveBeenCalledWith('coffee', { sourceUrls: ['invalid'] });
    fireEvent.click(buttons[1]);
    expect(session.updateNode).toHaveBeenCalledWith('coffee', { sourceUrls: ['https://site.test/crawl#section', 'invalid', candidates[1].url] });
  });
  it('discloses candidate truncation and never grows a full assignment budget', () => {
    const session = topicalSession({ availableUrlCandidates: [candidates[0]], matchingUrlCandidates: Array.from({ length: 101 }, () => candidates[0]) });
    session.selectedNode!.sourceUrls = Array.from({ length: 1000 }, (_, index) => `https://site.test/${index}`);
    render(<TopicalUrlAssignments session={session} />);
    expect(screen.getByText('semanticWorkspace.urlCandidatesLimited:101')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(session.updateNode).toHaveBeenCalledWith('coffee', { sourceUrls: session.selectedNode!.sourceUrls });
  });
});
