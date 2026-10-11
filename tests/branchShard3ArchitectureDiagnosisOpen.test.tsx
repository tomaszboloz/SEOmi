import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { CrawlArchitectureMainContent } from '@/components/Charts/crawlArchitecture/CrawlArchitectureMainContent';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }), initReactI18next: { type: '3rdParty', init: vi.fn() } }));
vi.mock('@/components/Charts/crawlArchitecture/topicalDiagnosis/TopicalDiagnosisView', () => ({
  TopicalDiagnosisView: ({ onOpenPage }: { onOpenPage: (url: string) => void }) => (
    <>
      <button data-testid="open-final" onClick={() => onOpenPage('https://final.test/landing')} />
      <button data-testid="open-unknown" onClick={() => onOpenPage('https://unknown.test/')} />
    </>
  ),
}));

const nodes = [
  { id: 'first', page: { url: 'https://first.test/', final_url: 'https://first.test/' } },
  { id: 'redirected', page: { url: 'https://old.test/', final_url: 'https://final.test/landing' } },
];
const makeState = () => ({
  activeProjectId: 'p', effectiveRunId: 'r', activeView: 'diagnosis',
  graph: { nodes, edges: [], totalEdges: 0, topicEdges: [], totalTopicEdges: 0, totalInternalLinks: 0, hasSemanticTerms: false, truncated: false },
  contentGraph: {}, visibleNodes: [], visibleEdges: [], visibleTopicEdges: [], preferences: {},
  diagnosis: null, setDiagnosisFilter: vi.fn(), setSelectedId: vi.fn(), setActiveView: vi.fn(), setPreferences: vi.fn(),
});
const renderWith = (state: ReturnType<typeof makeState>) => render(
  <CrawlArchitectureMainContent pages={[]} crawlMode="http" sitemapUrls={[]} runs={[]} currentRunId={undefined} state={state} />,
);

it('opens a diagnosed page in the graph by its final URL after lifting every filter', () => {
  const state = makeState();
  renderWith(state);
  fireEvent.click(screen.getByTestId('open-final'));
  expect(state.setSelectedId).toHaveBeenCalledWith('redirected');
  expect(state.setActiveView).toHaveBeenCalledWith('graph');
  const updater = state.setPreferences.mock.calls[0][0] as (previous: Record<string, unknown>) => Record<string, unknown>;
  expect(updater({ query: 'x', orphansOnly: true, clusterFilter: 'c', diagnosisFilter: 'd', keep: 1 })).toEqual({ keep: 1, diagnosisFilter: null, clusterFilter: 'all', orphansOnly: false, query: '' });
});

it('ignores a diagnosed page that is not part of the graph', () => {
  const state = makeState();
  renderWith(state);
  fireEvent.click(screen.getByTestId('open-unknown'));
  expect(state.setSelectedId).not.toHaveBeenCalled();
  expect(state.setActiveView).not.toHaveBeenCalled();
  expect(state.setPreferences).not.toHaveBeenCalled();
});
