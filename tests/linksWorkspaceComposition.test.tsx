import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LinksWorkspace } from '@/components/Charts/semanticTopical/LinksWorkspace';
import type { CrawledPageSummary } from '@/types';

const seen = vi.hoisted(() => ({ links: [] as unknown[], tracker: [] as unknown[] }));

vi.mock('@/components/Charts/InternalLinkOpportunitiesPanel', () => ({
  InternalLinkOpportunitiesPanel: (props: { pages: unknown[] }) => { seen.links.push(props); return <div data-testid="links">{props.pages.length}</div>; },
}));
vi.mock('@/components/Charts/DeploymentArtifactsPanel', () => ({ DeploymentArtifactsPanel: () => <div data-testid="deploy" /> }));
vi.mock('@/components/Charts/OptimizationTaskTracker', () => ({
  OptimizationTaskTracker: (props: { projectId: string }) => { seen.tracker.push(props); return <div data-testid="tracker">{props.projectId}</div>; },
}));

const page = (url: string) => ({ url, final_url: url, http_status: 200, title: url }) as unknown as CrawledPageSummary;

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
});
