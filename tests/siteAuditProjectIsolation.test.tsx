import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SiteAudit } from '@/components/Domain/SiteAudit';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import { useUIStore } from '@/stores/uiStore';

describe('Site Audit project-scoped form state', () => {
beforeEach(() => {
    localStorage.clear();
    useProjectStore.setState({
      projects: [
        { id: 'project-one', name: 'Pierwszy', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' },
        { id: 'project-two', name: 'Drugi', createdAt: '2026-09-24T00:00:00.000Z', lastOpenedAt: '2026-09-24T00:00:00.000Z' },
      ],
      activeProjectId: 'project-one',
    });
    useUIStore.setState({ sidebarCollapsed: false });
    useToolsStore.setState({ crawlUrl: 'https://one.example', crawlLimit: 500, crawlResult: null, crawlRuns: [] });
  });

it('reconciles URL and limit when the active project is switched', async () => {
    render(<SiteAudit />);

    const urlInput = screen.getByPlaceholderText('Enter website starting URL (e.g. https://example.com)...') as HTMLInputElement;
    const limitSelect = urlInput.closest('form')?.querySelector('select') as HTMLSelectElement;
    expect(urlInput.value).toBe('https://one.example');
    expect(limitSelect.value).toBe('500');

    // Simulate the project hydration that follows a project switch.
    act(() => {
      useProjectStore.setState({ activeProjectId: 'project-two' });
      useToolsStore.setState({ crawlUrl: '', crawlLimit: 25 });
    });

    await waitFor(() => {
      expect(urlInput.value).toBe('');
      expect(limitSelect.value).toBe('25');
    });

    fireEvent.change(urlInput, { target: { value: 'https://two.example' } });
    expect(urlInput.value).toBe('https://two.example');
  });

it('hydrates staging and production comparison URLs for the active project', async () => {
    render(<SiteAudit />);

    const stagingInput = screen.getByPlaceholderText(
      'https://staging.example.com',
    ) as HTMLInputElement;
    const productionInput = screen.getByPlaceholderText(
      'https://www.example.com',
    ) as HTMLInputElement;

    fireEvent.change(stagingInput, {
      target: { value: 'https://staging.one.example' },
    });
    fireEvent.change(productionInput, {
      target: { value: 'https://one.example' },
    });
    expect(
      JSON.parse(
        localStorage.getItem(
          'seomi_project_project-one_crawl_environments_v1',
        ) || '{}',
      ),
    ).toEqual({
      staging: 'https://staging.one.example',
      production: 'https://one.example',
    });

    localStorage.setItem(
      'seomi_project_project-two_crawl_environments_v1',
      JSON.stringify({
        staging: 'https://staging.two.example',
        production: 'https://two.example',
      }),
    );
    act(() => {
      useProjectStore.setState({ activeProjectId: 'project-two' });
    });

    await waitFor(() => {
      expect(stagingInput.value).toBe('https://staging.two.example');
      expect(productionInput.value).toBe('https://two.example');
    });

    act(() => {
      useProjectStore.setState({ activeProjectId: 'project-one' });
    });
    await waitFor(() => {
      expect(stagingInput.value).toBe('https://staging.one.example');
      expect(productionInput.value).toBe('https://one.example');
    });
  });

it('clears unsaved request-profile secrets when switching projects', async () => {
    render(<SiteAudit />);

    const profileSection = Array.from(document.querySelectorAll('details')).find(
      (element) => element.textContent?.includes('Request profile and authentication'),
    );
    expect(profileSection).toBeTruthy();
    fireEvent.click(profileSection?.querySelector('summary') as HTMLElement);

    const profileName = screen.getByPlaceholderText('e.g. Editorial account') as HTMLInputElement;
    const cookies = screen.getByPlaceholderText('session=…; consent=…') as HTMLInputElement;
    const proxy = screen.getByPlaceholderText('https://user:password@proxy.example:8443') as HTMLInputElement;
    const headers = screen.getByPlaceholderText(/Authorization: Bearer/) as HTMLTextAreaElement;

    fireEvent.change(profileName, { target: { value: 'Private staging' } });
    fireEvent.change(cookies, { target: { value: 'session=secret' } });
    fireEvent.change(proxy, { target: { value: 'http://proxy.example:8080' } });
    fireEvent.change(headers, { target: { value: 'Authorization: Bearer secret' } });
    expect(profileName.value).toBe('Private staging');
    expect(cookies.value).toBe('session=secret');

    act(() => {
      useProjectStore.setState({ activeProjectId: 'project-two' });
    });

    await waitFor(() => {
      expect(profileName.value).toBe('');
      expect(cookies.value).toBe('');
      expect(proxy.value).toBe('');
      expect(headers.value).toBe('');
    });
  });

it('keeps crawl execution disabled in the browser preview', () => {
    render(<SiteAudit />);

    expect(screen.getByRole('button', { name: /Start site crawl/i })).toHaveProperty('disabled', true);
    expect(screen.getAllByRole('status').some((element) => /This action requires the installed macOS or Windows desktop application/i.test(element.textContent || ''))).toBe(true);
    expect(useToolsStore.getState().interruptedCrawl).toBeNull();
  });
});
