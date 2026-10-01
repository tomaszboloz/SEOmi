import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BacklinkChecker } from '@/components/Domain/BacklinkChecker';
import { DomainOverview } from '@/components/Domain/DomainOverview';
import { KeywordResearch } from '@/components/Keywords/KeywordResearch';
import { AiBrandVisibility } from '@/components/AiVisibility/AiBrandVisibility';
import { useProjectStore } from '@/stores/projectStore';
import i18n from '@/i18n';
import { RankTracking } from '@/components/Keywords/RankTracking';
import { useToolsStore } from '@/stores/toolsStore';

describe('domain research request boundaries', () => {
beforeEach(() => {
    localStorage.clear();
    useProjectStore.setState({
      projects: [{ id: 'domain-research-project', name: 'Domain research', rootUrl: 'https://example.com', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' }],
      activeProjectId: 'domain-research-project',
    });
    useToolsStore.setState({
      keywordQuery: 'technical seo',
      keywordCountry: 'US',
      keywordResults: [],
      isKeywordLoading: false,
      keywordError: null,
      domainQuery: 'example.com',
      domainOverview: null,
      isDomainLoading: false,
      domainError: null,
      domainComparisonTargets: [],
      domainComparison: null,
      backlinkQuery: 'example.com',
      backlinkProfile: null,
      backlinkProfileHistory: [],
      isBacklinkLoading: false,
      backlinkError: null,
      backlinkGapCompetitors: [],
      backlinkGapIncludeSubdomains: true,
      backlinkGapReport: null,
      isBacklinkGapLoading: false,
      backlinkGapError: null,
      aiBrandQuery: '',
      aiBrandDomain: '',
    });
    vi.stubGlobal('fetch', vi.fn());
  });

afterEach(() => vi.unstubAllGlobals());

it('shows the five-request Domain Overview cost before submitting', () => {
    render(<DomainOverview />);
    expect(screen.getByText(i18n.t('dataforseo.paidRequests', { count: 5 }))).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

it('shows Keyword Research as a paid request before submitting', () => {
    render(<KeywordResearch />);
    expect(screen.getByText(i18n.t('dataforseo.paidRequests', { count: 1 }))).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

it('shows the full rank refresh fan-out count before submitting', () => {
    const original = useToolsStore.getState().trackedRanks;
    useToolsStore.setState({ trackedRanks: [{ id: 'one', keyword: 'first', domain: 'example.com', location: 'PL', language_code: 'pl', history: [], current_rank: null }, { id: 'two', keyword: 'second', domain: 'example.com', location: 'PL', language_code: 'pl', history: [], current_rank: null }] as never });
    render(<RankTracking />);
    expect(screen.getByText(i18n.t('dataforseo.paidRequests', { count: 2 }))).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
    useToolsStore.setState({ trackedRanks: original });
  });

it('does not spend a DataForSEO request when opening Domain Overview', () => {
    render(<DomainOverview />);
    expect(fetch).not.toHaveBeenCalled();
  });

it('does not spend a DataForSEO request when opening Backlink Checker', () => {
    render(<BacklinkChecker />);
    expect(fetch).not.toHaveBeenCalled();
  });

it('persists competitor drafts immediately for comparison and backlink-gap workflows', async () => {
    const comparisonOverview = {
      domain: 'example.com', organic_traffic: 120, organic_keywords: 12, domain_rank: 25, referring_domains: 8,
      top_keywords: [], top_pages: [], competitors: [],
    };
    useProjectStore.setState({
      projects: [
        ...useProjectStore.getState().projects,
        { id: 'domain-research-second', name: 'Second', rootUrl: 'https://second.example', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' },
      ],
    });
    useToolsStore.setState({ domainOverview: comparisonOverview, domainComparisonTargets: ['example.com'] });
    render(<DomainOverview />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Competitor domains to compare' }), { target: { value: 'one.example\ntwo.example' } });
    expect(JSON.parse(localStorage.getItem('seomi_project_domain-research-project_domain_comparison_targets_v1') || '[]')).toEqual(['example.com', 'one.example', 'two.example']);

    render(<BacklinkChecker />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Competitor domains for backlink gap analysis' }), { target: { value: 'one.example\ntwo.example' } });
    expect(JSON.parse(localStorage.getItem('seomi_backlink_gap_settings_domain-research-project') || '{}')).toMatchObject({ competitors: ['one.example', 'two.example'], includeSubdomains: true });

    act(() => useProjectStore.setState({ activeProjectId: 'domain-research-second' }));
    await useToolsStore.getState().hydrateProject('domain-research-second');
    expect(useToolsStore.getState().domainComparisonTargets).toEqual([]);
    expect(useToolsStore.getState().backlinkGapCompetitors).toEqual([]);
  });

it('does not spend a DataForSEO request when opening Keyword Research', () => {
    render(<KeywordResearch />);
    expect(fetch).not.toHaveBeenCalled();
  });

it('hydrates empty project-first targets from the active project without starting a request', async () => {
    useToolsStore.setState({ domainQuery: '', backlinkQuery: '', aiBrandDomain: '', aiBrandQuery: '' });

    render(<>
      <DomainOverview />
      <BacklinkChecker />
      <AiBrandVisibility />
    </>);

    await waitFor(() => {
      expect(useToolsStore.getState().domainQuery).toBe('https://example.com');
      expect(useToolsStore.getState().backlinkQuery).toBe('https://example.com');
      expect(useToolsStore.getState().aiBrandDomain).toBe('https://example.com');
    });
    expect(fetch).not.toHaveBeenCalled();
  });

it('does not refill a target after the user intentionally clears it', async () => {
    useToolsStore.setState({ domainQuery: '', backlinkQuery: '', aiBrandDomain: '', aiBrandQuery: '' });
    render(<DomainOverview />);

    await waitFor(() => expect(useToolsStore.getState().domainQuery).toBe('https://example.com'));
    act(() => useToolsStore.getState().setDomainQuery(''));
    await waitFor(() => expect(useToolsStore.getState().domainQuery).toBe(''));
  });
});
