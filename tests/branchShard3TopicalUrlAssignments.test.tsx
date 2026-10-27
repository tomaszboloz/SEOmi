import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { TopicalUrlAssignments } from '@/components/Charts/semanticTopical/TopicalUrlAssignments';
import { topicalSession } from './fixtures/topicalSessionContracts';

it('shows the root path for candidates whose URL has no path or cannot be parsed', () => {
  const candidates = [
    { url: 'custom://host', source: 'crawl' as const, title: 'Opaque' },
    { url: '', source: 'saved' as const, title: 'Blank' },
  ];
  const session = topicalSession({ availableUrlCandidates: candidates, matchingUrlCandidates: candidates });
  const { container } = render(<TopicalUrlAssignments session={session} />);
  const paths = [...container.querySelectorAll('span.font-mono')].map((node) => node.textContent);
  expect(paths).toEqual(['/', '/']);
  expect(screen.getByText('Blank')).toBeTruthy();
});

it('counts a planned URL that cannot be normalised as not crawled', () => {
  const session = topicalSession();
  session.selectedNode!.sourceUrls = ['::not a url::'];
  render(<TopicalUrlAssignments session={session} />);
  expect(screen.getByText('semanticWorkspace.currentRunCount:0')).toBeTruthy();
});
