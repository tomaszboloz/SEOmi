import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { HeadingsTree } from '@/components/Results/HeadingsTree';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import type { PageAuditData } from '@/types';
import i18n from '@/i18n';

const audit: PageAuditData = {
  url: 'https://example.com',
  final_url: 'https://example.com',
  timestamp: '2026-09-27T00:00:00.000Z',
  http_status: 200,
  response_time_ms: 120,
  redirect_chain: [],
  meta_tags: { title: 'Technical SEO', title_length: 13, description: 'Technical SEO page', description_length: 19, other_tags: [] },
  open_graph: { all_tags: [] },
  twitter_card: { all_tags: [] },
  headings: { h1_count: 1, h1_texts: ['Technical SEO'], hierarchy: [{ level: 1, text: 'Technical SEO', children: [] }], has_valid_hierarchy: true, issues: [] },
  images: [],
  links: { total_links: 0, internal_links: 0, external_links: 0, nofollow_links: 0, links: [] },
  security_headers: { score: 90 },
  structured_data: [],
  technical: { hreflang_tags: [] },
  health_score: 95,
  issues: [],
  content_stats: { word_count: 20, reading_time_minutes: 1, text_ratio_percent: 10, top_keywords: [], body_text: 'Technical SEO content' },
};

describe('headings keyphrase project persistence', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('en');
    useProjectStore.setState({
      projects: [
        { id: 'headings-a', name: 'Headings A', rootUrl: 'https://example.com', createdAt: '2026-09-27T00:00:00.000Z', lastOpenedAt: '2026-09-27T00:00:00.000Z' },
        { id: 'headings-b', name: 'Headings B', rootUrl: 'https://other.example', createdAt: '2026-09-27T00:00:00.000Z', lastOpenedAt: '2026-09-27T00:00:00.000Z' },
      ],
      activeProjectId: 'headings-a',
    });
    useAuditStore.setState({ showOnlyProblems: false });
  });

  it('restores the phrase for the same project and audit target without leaking it', async () => {
    const view = render(<HeadingsTree audit={audit} />);
    const input = screen.getByPlaceholderText('e.g. SEO audit');
    fireEvent.change(input, { target: { value: 'technical seo' } });

    const key = `seomi_project_headings-a_headings_keyphrase_${encodeURIComponent('https://example.com')}_v1`;
    expect(localStorage.getItem(key)).toBe('technical seo');

    view.unmount();
    render(<HeadingsTree audit={audit} />);
    expect((screen.getByPlaceholderText('e.g. SEO audit') as HTMLInputElement).value).toBe('technical seo');

    act(() => useProjectStore.setState({ activeProjectId: 'headings-b' }));
    await waitFor(() => expect((screen.getByPlaceholderText('e.g. SEO audit') as HTMLInputElement).value).toBe(''));
    act(() => useProjectStore.setState({ activeProjectId: 'headings-a' }));
    await waitFor(() => expect((screen.getByPlaceholderText('e.g. SEO audit') as HTMLInputElement).value).toBe('technical seo'));
  });
});
