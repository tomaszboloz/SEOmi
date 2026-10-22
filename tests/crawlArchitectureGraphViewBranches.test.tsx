import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { CrawlArchitectureGraphView } from '@/components/Charts/crawlArchitecture/CrawlArchitectureGraphView';

const view = vi.hoisted(() => vi.fn());
vi.mock('@/components/Charts/crawlArchitecture/cytoscapeMap/CytoscapeMapView', () => ({
  CytoscapeMapView: (props: object) => { view(props); return <div data-testid="cyto-view" />; },
}));

it('delegates the graph tab to the Cytoscape map with crawl context', () => {
  const state = { visibleNodes: [] };
  render(<CrawlArchitectureGraphView state={state} crawlMode="full" pages={[]} startUrl="https://x.test/" />);

  expect(screen.getByTestId('cyto-view')).toBeTruthy();
  expect(view).toHaveBeenCalledWith({ state, crawlMode: 'full', pages: [], startUrl: 'https://x.test/' });
});
