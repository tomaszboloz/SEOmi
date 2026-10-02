import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MainContent } from '@/components/Layout/MainContent';
import { DataForSEOAudit } from '@/components/Results/DataForSEOAudit';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import type { PageAuditData } from '@/types';

const audit: PageAuditData = {
  url: 'https://example.com',
  final_url: 'https://example.com',
  timestamp: '2026-09-24T00:00:00.000Z',
  http_status: 200,
  response_time_ms: 120,
  redirect_chain: [],
  meta_tags: { title: 'Example', title_length: 7, description: 'Example page', description_length: 12, other_tags: [] },
  open_graph: { all_tags: [] },
  twitter_card: { all_tags: [] },
  headings: { h1_count: 1, h1_texts: ['Example'], hierarchy: [{ level: 1, text: 'Example', children: [] }], has_valid_hierarchy: true, issues: [] },
  images: [],
  links: { total_links: 0, internal_links: 0, external_links: 0, nofollow_links: 0, links: [] },
  security_headers: { score: 90 },
  structured_data: [],
  technical: { hreflang_tags: [] },
  health_score: 95,
  issues: [],
  content_stats: { word_count: 20, reading_time_minutes: 1, text_ratio_percent: 10, top_keywords: [] },
};

describe('audit result tabs accessibility contract', () => {
  beforeEach(() => {
    useProjectStore.setState({ projects: [{ id: 'tabpanel-project', name: 'Tab panel project', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' }], activeProjectId: 'tabpanel-project' });
    useAuditStore.setState({ currentAudit: audit, activeTab: 'overview', isLoading: false, error: null, showOnlyProblems: false });
  });

  it('connects the selected tab to its content panel and updates the relationship on navigation', async () => {
    // This test verifies ARIA relationships. Load the real chunks before
    // rendering so cold CI transforms are not bounded by findByRole's 1s.
    await Promise.all([
      import('@/components/Results/AuditTabs'),
      import('@/components/Results/Overview'),
      import('@/components/Results/MetadataTable'),
    ]);
    render(<MainContent />);

    const overviewTab = await screen.findByRole('tab', { name: 'Overview' }, { timeout: 5000 });
    const panel = screen.getByRole('tabpanel');
    expect(overviewTab.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(overviewTab.id);

    fireEvent.click(screen.getByRole('tab', { name: /Meta Tags|Metadata/i }));
    await waitFor(() => expect(useAuditStore.getState().activeTab).toBe('metadata'));
    await waitFor(() => expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe('audit-tab-metadata'));
  });

  it('keeps DataForSEO independently callable from the project root before a page audit exists', async () => {
    useProjectStore.setState({
      projects: [{ id: 'standalone-dataforseo', name: 'Standalone project', rootUrl: 'https://example.com', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' }],
      activeProjectId: 'standalone-dataforseo',
    });
    useAuditStore.setState({ currentAudit: null, activeTab: 'dataforseo', isLoading: false, error: null });

    render(<MainContent />);

    expect(await screen.findByText(/DataForSEO/, undefined, { timeout: 5000 })).not.toBeNull();
    expect(screen.getByText('example.com')).not.toBeNull();
    expect(screen.queryByText(/No audit in this project/i)).toBeNull();
  });

  it('persists the SERP keyword and market per project without issuing a request on hydration', async () => {
    useProjectStore.setState({
      projects: [
        { id: 'serp-input-a', name: 'A', rootUrl: 'https://a.example', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' },
        { id: 'serp-input-b', name: 'B', rootUrl: 'https://b.example', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' },
      ],
      activeProjectId: 'serp-input-a',
    });

    render(<DataForSEOAudit />);
    const keyword = await screen.findByRole('textbox', { name: /SERP keyword|Fraza SERP/i }, { timeout: 5000 });
    fireEvent.change(keyword, { target: { value: 'technical seo' } });
    fireEvent.change(screen.getByRole('combobox', { name: /SERP location|Lokalizacja SERP/i }), { target: { value: '2616' } });

    await waitFor(() => expect(JSON.parse(localStorage.getItem('seomi_project_serp-input-a_dataforseo_serp_input_v1') || '{}')).toEqual({ keyword: 'technical seo', locationCode: 2616, languageCode: 'en' }));

    act(() => useProjectStore.setState({ activeProjectId: 'serp-input-b' }));
    await waitFor(() => expect((screen.getByRole('textbox', { name: /SERP keyword|Fraza SERP/i }) as HTMLInputElement).value).toBe(''));

    act(() => useProjectStore.setState({ activeProjectId: 'serp-input-a' }));
    await waitFor(() => {
      expect((screen.getByRole('textbox', { name: /SERP keyword|Fraza SERP/i }) as HTMLInputElement).value).toBe('technical seo');
      expect((screen.getByRole('combobox', { name: /SERP location|Lokalizacja SERP/i }) as HTMLSelectElement).value).toBe('2616');
    });
  });
});
