import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SeoToolsWorkspace } from '@/components/SeoTools/SeoToolsWorkspace';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';

describe('SEO utilities workspace route', () => {
beforeEach(() => {
    localStorage.clear();
    useProjectStore.setState({
      projects: [{ id: 'seo-tools-a', name: 'Primary site', rootUrl: 'https://example.com', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' }],
      activeProjectId: 'seo-tools-a',
    });
    useToolsStore.setState({
      domainQuery: '',
      domainOverview: null,
      isDomainLoading: false,
      domainError: null,
      keywordResults: [],
      isKeywordLoading: false,
      keywordError: null,
    });
    vi.stubGlobal('fetch', vi.fn());
  });

afterEach(() => vi.unstubAllGlobals());

it('renders every utility tab and persists the selected tab per project', async () => {
    render(<SeoToolsWorkspace />);
    expect(screen.getAllByRole('tab')).toHaveLength(7);

    fireEvent.click(screen.getAllByRole('tab')[1]);
    expect(localStorage.getItem('seomi_project_seo-tools-a_seo_tools_tab_v1')).toBe('competitor-keywords');

    act(() => useProjectStore.setState({
      projects: [
        ...useProjectStore.getState().projects,
        { id: 'seo-tools-b', name: 'Second site', rootUrl: 'https://second.example', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' },
      ],
      activeProjectId: 'seo-tools-b',
    }));
    await waitFor(() => expect(screen.getAllByRole('tab')[0].getAttribute('aria-selected')).toBe('true'));
    expect(screen.getAllByRole('tab')[1].getAttribute('aria-selected')).toBe('false');
  });

it('restores editable SEO utility domains after leaving and reopening a panel', async () => {
    render(<SeoToolsWorkspace />);

    fireEvent.click(screen.getAllByRole('tab')[4]);
    const ageInput = screen.getByLabelText('Domain');
    fireEvent.change(ageInput, { target: { value: 'https://age.example.test' } });
    expect(localStorage.getItem('seomi_project_seo-tools-a_seo_domain_age_input_v1')).toBe('https://age.example.test');

    fireEvent.click(screen.getAllByRole('tab')[0]);
    fireEvent.click(screen.getAllByRole('tab')[4]);
    expect((screen.getByLabelText('Domain') as HTMLInputElement).value).toBe('https://age.example.test');

    fireEvent.click(screen.getAllByRole('tab')[1]);
    const competitorInput = screen.getByLabelText('Competitor domain');
    fireEvent.change(competitorInput, { target: { value: 'competitor.example.test' } });
    expect(localStorage.getItem('seomi_project_seo-tools-a_seo_competitor_keywords_input_v1')).toBe('competitor.example.test');

    fireEvent.click(screen.getAllByRole('tab')[0]);
    fireEvent.click(screen.getAllByRole('tab')[1]);
    expect((screen.getByLabelText('Competitor domain') as HTMLInputElement).value).toBe('competitor.example.test');
  });

it('mounts every utility panel without leaving a broken route fallback', async () => {
    render(<SeoToolsWorkspace />);

    for (const tab of screen.getAllByRole('tab')) {
      fireEvent.click(tab);
      await waitFor(() => {
        expect(tab.getAttribute('aria-selected')).toBe('true');
        expect(screen.getByRole('tabpanel').textContent?.trim().length).toBeGreaterThan(0);
        expect(screen.queryByRole('alert')).toBeNull();
      });
    }
  });

it('keeps the traffic checker as a dedicated live-metrics workflow', async () => {
    useToolsStore.setState({
      domainQuery: 'example.com',
      domainOverview: {
        domain: 'example.com',
        organic_traffic: 1200,
        organic_keywords: 84,
        domain_rank: 41,
        referring_domains: 23,
        top_keywords: [],
        top_pages: [],
        competitors: [],
      },
    });

    render(<SeoToolsWorkspace />);
    fireEvent.click(screen.getAllByRole('tab')[6]);

    await waitFor(() => {
      expect(screen.getByRole('tabpanel').textContent).toContain('1,200');
      expect(screen.getByRole('tabpanel').textContent).toContain('84');
      expect(screen.getByRole('tabpanel').textContent).toContain('23');
      expect(screen.getByRole('tabpanel').textContent).not.toContain('Top organic keywords');
    });
  });

it('keeps the domain-age lookup local and reports invalid input without crashing', async () => {
    render(<SeoToolsWorkspace />);
    fireEvent.click(screen.getAllByRole('tab')[4]);
    fireEvent.change(screen.getByLabelText('Domain'), { target: { value: 'not a domain' } });
    fireEvent.click(screen.getByRole('button', { name: /Check domain|Sprawdź domenę|Comprobar dominio|Domain prüfen|Vérifier le domaine|Controlla dominio|Verificar domínio|Проверить домен|ドメインを確認|检查域名|도메인 확인|فحص النطاق/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(fetch).not.toHaveBeenCalled();
  });

it('surfaces a timed-out registry request as a controlled error', async () => {
    vi.stubGlobal('fetch', vi.fn((_input: RequestInfo, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })));
    vi.useFakeTimers();
    render(<SeoToolsWorkspace />);
    fireEvent.click(screen.getAllByRole('tab')[4]);
    fireEvent.click(screen.getByRole('button', { name: /Check domain/i }));
    await vi.advanceTimersByTimeAsync(10_000);
    vi.useRealTimers();
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  });
});
