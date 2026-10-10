import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CrawlArchitectureMainContent } from '@/components/Charts/crawlArchitecture/CrawlArchitectureMainContent';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${values.count ?? JSON.stringify(values)}` : key,
  }),
}));
vi.mock('@/components/Charts/SemanticTopicalWorkspace', () => ({
  SemanticTopicalWorkspace: () => <div data-testid="plan-view" />,
}));
vi.mock('@/components/Charts/CrawlDirectoryTree', () => ({
  CrawlDirectoryTree: ({ onSelectPage }: { onSelectPage: (url: string) => void }) => (
    <button data-testid="directory-view" onClick={() => { onSelectPage('https://known.test'); onSelectPage('https://missing.test'); }} />
  ),
}));
vi.mock('@/components/Charts/crawlArchitecture/CrawlArchitectureGraphView', () => ({
  CrawlArchitectureGraphView: () => <div data-testid="graph-view" />,
}));

const graphState = (patch: Record<string, unknown> = {}) => ({
  activeProjectId: 'project-one', effectiveRunId: 'run-one', activeView: 'graph',
  graph: {
    nodes: [{ id: 'known-node', page: { url: 'https://known.test' }, orphan: true }],
    edges: Array.from({ length: 12 }, () => ({})), totalEdges: 13,
    topicEdges: Array.from({ length: 12 }, () => ({})), totalTopicEdges: 13,
    totalInternalLinks: 12, hasSemanticTerms: false, truncated: true,
  },
  contentGraph: {}, visibleNodes: [], visibleEdges: Array.from({ length: 12 }, () => ({})),
  visibleTopicEdges: Array.from({ length: 12 }, () => ({})), preferences: { linkMode: 'all' },
  setSelectedId: vi.fn(), ...patch,
});

const props = {
  pages: [
    { semantic_content_source: 'primary-root', semantic_content_partial: true },
    { semantic_content_source: 'body-fallback' },
    {},
  ], crawlMode: 'browser-rendered', sitemapUrls: [], runs: [], currentRunId: undefined,
};

describe('CrawlArchitectureMainContent direct contracts', () => {
  it('renders plan view without graph chrome', () => {
    render(<CrawlArchitectureMainContent {...props} state={graphState({ activeView: 'plan' })} />);
    expect(screen.getByTestId('plan-view')).toBeTruthy();
  });

  it('selects a matching directory node and ignores an unknown URL', () => {
    const setSelectedId = vi.fn();
    render(<CrawlArchitectureMainContent {...props} state={graphState({ activeView: 'directory', setSelectedId })} />);
    fireEvent.click(screen.getByTestId('directory-view'));
    expect(setSelectedId).toHaveBeenCalledOnce();
    expect(setSelectedId).toHaveBeenCalledWith('known-node');
  });

  it('exposes full-link metrics, plural edge cases, provenance and truncation', () => {
    render(<CrawlArchitectureMainContent {...props} state={graphState()} />);
    expect(screen.getByText('mapUi.graph.fullTitle')).toBeTruthy();
    expect(screen.getByText(/mapUi\.plural\.relation\.many:12/)).toBeTruthy();
    expect(screen.getAllByText(/mapUi\.metrics\.total/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('mapUi.noterms')).toBeTruthy();
    expect(screen.getByText('mapUi.truncated')).toBeTruthy();
    expect(screen.getByTestId('graph-view')).toBeTruthy();
  });
});
