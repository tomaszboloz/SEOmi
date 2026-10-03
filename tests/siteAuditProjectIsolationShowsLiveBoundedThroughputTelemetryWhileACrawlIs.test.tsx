import { fireEvent, render, screen } from '@testing-library/react';
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

it('shows live bounded throughput telemetry while a crawl is running', () => {
    useToolsStore.setState({
      isCrawling: true,
      crawlProgress: 40,
      crawlProgressDetail: {
        runId: 'live-run',
        currentUrl: 'https://one.example/page',
        discovered: 10,
        completed: 4,
        queued: 6,
        cancelled: false,
        paused: false,
        elapsedMs: 125_000,
        pagesPerSecond: 0.8,
      },
    });

    render(<SiteAudit />);

    expect(screen.getByLabelText('Live crawl telemetry')).toBeTruthy();
    expect(screen.getByText('4/10')).toBeTruthy();
    expect(screen.getByText('2:05')).toBeTruthy();
    expect(screen.getByText('0.8 URLs/s')).toBeTruthy();
  });

it('uses the localized default name when adding a custom search', () => {
    render(<SiteAudit />);

    fireEvent.click(screen.getByRole('button', { name: /Add query/i }));

    expect(screen.getByDisplayValue('Custom 1')).toBeTruthy();
  });

it('switches custom search configuration to bounded source-HTML regex mode', () => {
    render(<SiteAudit />);

    fireEvent.click(screen.getByRole('button', { name: /Add query/i }));
    fireEvent.change(screen.getAllByRole('combobox', { name: /Selector type/ })[0], {
      target: { value: 'regex' },
    });

    expect(screen.getByPlaceholderText('data-sku="([^"]+)"')).toBeTruthy();
    expect(screen.getAllByRole('combobox', { name: /Result type/ })[0]).toHaveProperty(
      'disabled',
      true,
    );
  });
});
