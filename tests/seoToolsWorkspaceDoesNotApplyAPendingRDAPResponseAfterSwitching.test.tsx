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

it('does not apply a pending RDAP response after switching projects', async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    })));
    useProjectStore.setState({
      projects: [
        ...useProjectStore.getState().projects,
        { id: 'seo-tools-b', name: 'Second site', rootUrl: 'https://second.example', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' },
      ],
    });

    render(<SeoToolsWorkspace />);
    fireEvent.click(screen.getAllByRole('tab')[4]);
    fireEvent.click(screen.getByRole('button', { name: /Check domain/i }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    act(() => useProjectStore.setState({ activeProjectId: 'seo-tools-b' }));
    fireEvent.click(screen.getAllByRole('tab')[4]);
    await waitFor(() => {
      expect((screen.getByLabelText('Domain') as HTMLInputElement).value).toBe('https://second.example');
    });

    resolveResponse?.(new Response(JSON.stringify({
      ldhName: 'first.example',
      events: [{ eventAction: 'registration', eventDate: '2020-01-01T00:00:00Z' }],
    }), { status: 200 }));
    await waitFor(() => expect(screen.queryByText('first.example')).toBeNull());
  });
});
