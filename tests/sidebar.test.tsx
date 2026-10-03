import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Sidebar } from '@/components/Layout/Sidebar';
import { Header } from '@/components/Layout/Header';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';

describe('workspace sidebar information architecture', () => {
beforeEach(() => {
    localStorage.clear();
    useProjectStore.setState({
      projects: [{ id: 'sidebar-project', name: 'Sidebar project', createdAt: '2026-09-23T00:00:00.000Z', lastOpenedAt: '2026-09-23T00:00:00.000Z' }],
      activeProjectId: 'sidebar-project',
    });
    useUIStore.setState({ sidebarCollapsed: false, collapsedSections: {}, activeModal: null });
    useAuditStore.setState({ activeTab: 'overview', currentAudit: null });
  });

it('groups single-page audit, technical crawling, and the semantic map before domain research', () => {
    render(<Sidebar />);

    expect(screen.getByRole('button', { name: /Audits & Crawling/i })).not.toBeNull();
    expect(screen.getByRole('button', { name: /Domain & Backlinks/i })).not.toBeNull();
    expect(screen.getByRole('button', { name: /Site Audit Crawler/i })).not.toBeNull();
    expect(screen.getAllByRole('button', { name: /Overview/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /Semantic map/i })).not.toBeNull();
    expect(screen.getByRole('button', { name: /Backlink Checker/i })).not.toBeNull();
  });

it('puts project creation before workflow navigation', () => {
    render(<Sidebar />);
    const navigation = screen.getByRole('navigation', { name: /Application modules|Moduły aplikacji/i });
    expect(navigation.querySelector('button')?.getAttribute('aria-label')).toMatch(/Create new project|Utwórz nowy projekt/i);
  });

it('keeps project switching in the first context block', () => {
    render(<><Header /><Sidebar /></>);

    const projectContext = screen.getByRole('button', { name: /Active project|Aktywny projekt/i });
    fireEvent.click(projectContext);

    expect(document.activeElement).toBe(screen.getByRole('combobox', { name: /Active project|Aktywny projekt/i }));
  });

it('renders modules in the task flow order from audit to research and workspace settings', () => {
    render(<Sidebar />);

    const moduleButtons = Array.from(
      screen.getByRole('navigation', { name: /Application modules|Moduły aplikacji/i }).querySelectorAll('button'),
    ).map((button) => button.textContent?.trim());
    const sectionOrder = [
      'AUDITS & CRAWLING',
      'KEYWORD RESEARCH',
      'DOMAIN & BACKLINKS',
      'PERFORMANCE & UX',
      'GOOGLE & DATA',
      'AI VISIBILITY & GEO',
      'AGENT WORKFLOWS',
      'WORKSPACE TOOLS',
    ];
    const indices = sectionOrder.map((label) => moduleButtons.findIndex((text) => text?.toLowerCase().startsWith(label.toLowerCase())));
    expect(indices.every((index) => index >= 0)).toBe(true);
    expect(indices).toEqual([...indices].sort((left, right) => left - right));
  });

it('exposes DataForSEO as a first-class Google & Data workflow', () => {
    render(<Sidebar />);

    const dataForSeo = screen.getByRole('button', { name: /DataForSEO/i });
    expect(dataForSeo).not.toBeNull();
    fireEvent.click(dataForSeo);

    expect(useAuditStore.getState().activeTab).toBe('dataforseo');
    expect(dataForSeo.getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: /Google & Data/i }).className).toContain('text-emerald');
  });

it('exposes the semantic map as a direct crawl workflow and leaves a handoff for the results view', () => {
    render(<Sidebar />);

    fireEvent.click(screen.getByRole('button', { name: /Semantic map/i }));

    expect(useAuditStore.getState().activeTab).toBe('site-audit');
    expect(sessionStorage.getItem('seomi_open_crawl_map_v1')).toBe('1');
  });

it('keeps workspace tools discoverable in a collapsible section', () => {
    render(<Sidebar />);

    expect(screen.getByRole('button', { name: /Workspace tools/i })).not.toBeNull();
    expect(screen.getByRole('button', { name: /Audit history/i })).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Audit history/i }));
    expect(useUIStore.getState().activeModal).toBe('history');
  });

it('persists collapsed sections per project and restores them after remount', async () => {
    const { unmount } = render(<Sidebar />);
    const sectionToggle = screen.getByRole('button', { name: /Audits & Crawling/i });

    fireEvent.click(sectionToggle);
    expect(sectionToggle.getAttribute('aria-expanded')).toBe('false');
    expect(localStorage.getItem('seomi_project_sidebar-project_sidebar_sections_v1')).toContain('audit-workspace');
    expect(screen.queryByRole('button', { name: /Site Audit Crawler/i })).toBeNull();

    unmount();
    useUIStore.setState({ collapsedSections: {} });
    render(<Sidebar />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Audits & Crawling/i }).getAttribute('aria-expanded')).toBe('false');
    });
    expect(screen.queryByRole('button', { name: /Site Audit Crawler/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Audits & Crawling/i }));
    expect(screen.getByRole('button', { name: /Audits & Crawling/i }).getAttribute('aria-expanded')).toBe('true');
  });

it('keeps legacy page-audit or crawler collapse preferences after the groups are combined', async () => {
    localStorage.setItem('seomi_project_sidebar-project_sidebar_sections_v1', JSON.stringify({ 'crawl-technical': true }));
    render(<Sidebar />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Audits & Crawling/i }).getAttribute('aria-expanded')).toBe('false');
    });
    expect(screen.queryByRole('button', { name: /Site Audit Crawler/i })).toBeNull();
  });

it('marks the active module and exposes labels in collapsed mode', () => {
    useAuditStore.setState({ activeTab: 'site-audit' });
    useUIStore.setState({ sidebarCollapsed: true });
    render(<Sidebar />);

    expect(screen.getByRole('button', { name: /Site Audit Crawler/i }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByTitle('Site Audit Crawler')).not.toBeNull();
    expect(screen.getByRole('button', { name: /Expand menu|Rozwiń menu/i }).getAttribute('aria-pressed')).toBe('true');
  });

it('persists the compact sidebar preference', () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByRole('button', { name: /Collapse menu|Zwiń menu/i }));

    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    expect(localStorage.getItem('seomi_sidebar_collapsed_v1')).toBe('true');
  });
});
