import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { CrawlAuthorityTab } from '@/components/Domain/crawlResults/authority/CrawlAuthorityTab';

const report = {
  taxonomy: {}, tas: 50,
  coverage: [{ subtopicId: 's1', pillar: 'p', label: 'Sub one', status: 'missing_gap', importance: 1, similarity: 0, urls: [], coverage: 0, entitiesPresent: [], entitiesMissing: [], questionsMissing: [] }],
};
vi.mock('@/hooks/useSiteFocus', () => ({ useSiteFocus: () => ({ report: null }) }));
vi.mock('@/hooks/useTopicalAuthority', () => ({ useTopicalAuthority: () => ({ report, taxonomy: null, state: { running: false, progress: null, failure: null, error: null }, benchmark: null, history: [], build: vi.fn(), cancel: vi.fn(), clear: vi.fn() }) }));
vi.mock('@/components/Domain/crawlResults/authority/AuthorityHero', () => ({ AuthorityHero: () => null }));
vi.mock('@/components/Domain/crawlResults/authority/AuthorityPillars', () => ({ AuthorityPillars: () => null }));
vi.mock('@/components/Domain/crawlResults/authority/CannibalizationPanel', () => ({ CannibalizationPanel: (props: { gsc: unknown }) => <div>gsc:{String(props.gsc)}</div> }));
vi.mock('@/components/Domain/crawlResults/authority/AuthorityRecommendations', () => ({ AuthorityRecommendations: () => null }));
vi.mock('@/components/Domain/crawlResults/authority/AuthorityBenchmark', () => ({ AuthorityBenchmark: () => null }));
vi.mock('@/components/Domain/crawlResults/authority/AuthorityHistoryChart', () => ({ AuthorityHistoryChart: () => null }));
vi.mock('@/components/Domain/crawlResults/authority/SubtopicDrilldown', () => ({ SubtopicDrilldown: (props: { onBack: () => void }) => <button type="button" onClick={props.onBack}>back</button> }));
vi.mock('@/components/Domain/crawlResults/authority/CoverageMap', () => ({
  CoverageMap: (props: { view: { url: string }; onSelect: (id: string) => void; onViewChange: (view: unknown) => void }) => (
    <div>
      <span>url:{props.view.url}</span>
      <button type="button" onClick={() => props.onViewChange({ ...props.view, url: 'kept' })}>set</button>
      <button type="button" onClick={() => props.onSelect('s1')}>open</button>
    </div>
  ),
}));

beforeEach(async () => { localStorage.clear(); await i18n.changeLanguage('en'); });

describe('authority tab keeps coverage view per project (#60 GEM-60-05/T03/T04)', () => {
  it('keeps filters through drill-down and back, resets them on another project', () => {
    const view = render(<CrawlAuthorityTab pages={[]} startUrl="https://a.test/" projectId="project-a" />);
    fireEvent.click(screen.getByText('set'));
    fireEvent.click(screen.getByText('open'));
    fireEvent.click(screen.getByText('back'));
    expect(screen.getByText('url:kept')).toBeTruthy();
    view.rerender(<CrawlAuthorityTab pages={[]} startUrl="https://a.test/" projectId="project-a" />);
    expect(screen.getByText('url:kept')).toBeTruthy();
    view.rerender(<CrawlAuthorityTab pages={[]} startUrl="https://b.test/" projectId="project-b" />);
    expect(screen.getByText('url:')).toBeTruthy();
    expect(screen.getByText('gsc:null')).toBeTruthy();
  });

  it('passes no GSC evidence without a project', () => {
    render(<CrawlAuthorityTab pages={[]} startUrl="https://a.test/" />);
    expect(screen.getByText('gsc:null')).toBeTruthy();
  });
});
