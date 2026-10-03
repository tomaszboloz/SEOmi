import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { CrawlArchitectureGraph } from '@/components/Charts/CrawlArchitectureGraph';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/stores/projectStore', () => ({
  useProjectStore: () => 'proj-1',
}));
vi.mock('@/stores/toolsStore', () => ({
  useToolsStore: () => 'run-1',
}));
vi.mock('@/stores/uiStore', () => ({
  useUIStore: () => false,
}));
vi.mock('@/services/semanticMap', () => ({
  buildSemanticMap: () => ({ nodes: [], edges: [], topicEdges: [], clusters: [], hasSemanticTerms: true, totalInternalLinks: 0, totalEdges: 0, totalTopicEdges: 0 }),
}));
vi.mock('@/components/Charts/SemanticTopicalWorkspace', () => ({
  SemanticTopicalWorkspace: () => <div data-testid="semantic-topical-workspace">Topical Workspace</div>
}));
vi.mock('@/components/Charts/CrawlDirectoryTree', () => ({
  CrawlDirectoryTree: () => <div data-testid="crawl-directory-tree">Directory Tree</div>
}));

describe('CrawlArchitecture Components', () => {
  it('renders CrawlArchitectureGraph facade', () => {
    const { container } = render(<CrawlArchitectureGraph pages={[]} startUrl="https://example.com" crawlMode="http" />);
    expect(container).toBeTruthy();
  });
});
