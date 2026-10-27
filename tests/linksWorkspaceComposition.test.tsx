import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LinksWorkspace } from '@/components/Charts/semanticTopical/LinksWorkspace';
import type { CrawledPageSummary } from '@/types';
import { createCrawlPageFixture } from './fixtures/crawl';

const seen = vi.hoisted(() => ({ links: [] as unknown[], tracker: [] as unknown[] }));

vi.mock('@/components/Charts/InternalLinkOpportunitiesPanel', () => ({
  InternalLinkOpportunitiesPanel: (props: { pages: unknown[] }) => { seen.links.push(props); return <div data-testid="links">{props.pages.length}</div>; },
}));
vi.mock('@/components/Charts/DeploymentArtifactsPanel', () => ({ DeploymentArtifactsPanel: () => <div data-testid="deploy" /> }));
vi.mock('@/components/Charts/OptimizationTaskTracker', () => ({
  OptimizationTaskTracker: (props: { projectId: string }) => { seen.tracker.push(props); return <div data-testid="tracker">{props.projectId}</div>; },
}));

const page = (url: string) => createCrawlPageFixture({ url, final_url: url, title: url });

describe('LinksWorkspace', () => {
  it('renders opportunities and artifacts without a tracker when no project is open', () => {
    render(<LinksWorkspace projectId={null} pages={[page('https://a/')]} />);
    expect(screen.getByTestId('links').textContent).toBe('1');
    expect(screen.getByTestId('deploy')).toBeTruthy();
    expect(screen.queryByTestId('tracker')).toBeNull();
  });

  it('survives an empty crawl and mounts the tracker for an open project', () => {
    render(<LinksWorkspace projectId="p1" pages={[]} />);
    expect(screen.getByTestId('links').textContent).toBe('0');
    expect(screen.getByTestId('tracker').textContent).toBe('p1');
  });

  it('passes bus quarantine data to the opportunities panel', () => {
    render(<LinksWorkspace projectId={null} pages={[page('https://a/'), page('https://a/b')]} />);
    const props = seen.links.at(-1) as { quarantine: unknown; conflicts: unknown };
    expect(Array.isArray(props.quarantine) || typeof props.quarantine === 'object').toBe(true);
    expect(props.conflicts).toBeDefined();
  });

  it('passes the selected run and exposes real SPRS and EETV scores', () => {
    const first = page('https://a/');
    const second = { ...page('https://a/b'), links: [{ target_url: first.url, anchor_text: 'home', is_internal: true }] } as CrawledPageSummary;
    const selectedPages = [first, second];
    render(<LinksWorkspace projectId="p2" pages={selectedPages} run={{ id: 'run-2', startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T00:01:00Z', result: { pages: selectedPages, cancelled: false } } as never} />);
    const props = seen.tracker.at(-1) as { crawlStartedAt: string; scoreFor: (task: { module: string; url: string }) => number | null };
    expect(props.crawlStartedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(typeof props.scoreFor({ module: 'sprs', url: first.url })).toBe('number');
    expect(typeof props.scoreFor({ module: 'eetv', url: first.url })).toBe('number');
  });

  it('defers scores and verification when the run is incomplete or not the pages snapshot', () => {
    const current = page('https://a/current');
    const other = page('https://a/other');
    render(<LinksWorkspace projectId="p3" pages={[current]} run={{ id: 'inflight', startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T00:01:00Z', result: { pages: [other], cancelled: false } } as never} />);
    const props = seen.tracker.at(-1) as { crawlStartedAt: string; scoreFor: (task: { module: string; url: string }) => number | null };
    expect(props.crawlStartedAt).toBe('unavailable');
    expect(props.scoreFor({ module: 'eetv', url: current.url })).toBeNull();
  });
});
