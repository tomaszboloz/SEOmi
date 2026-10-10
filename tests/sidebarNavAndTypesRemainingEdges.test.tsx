import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SidebarNavItem } from '@/components/Layout/sidebar/SidebarNavItem';
import { SidebarSectionHeader } from '@/components/Layout/sidebar/SidebarSectionHeader';
import {
  navigationSearchKey,
  pageAuditTabIds,
  persistNavigationSearch,
  readNavigationSearch,
  sectionId,
} from '@/components/Layout/sidebar/sidebarTypes';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const Icon = () => <span data-testid="nav-icon" />;
const section = { key: 'tools', titleKey: 'sidebar.tools', items: [] };

describe('remaining sidebar navigation edges', () => {
  beforeEach(() => localStorage.clear());

  it('runs action and tab navigation, including collapsed labels and badges', () => {
    const action = vi.fn();
    const setActiveTab = vi.fn();
    const actionItem = { labelKey: 'sidebar.action', keywords: '', icon: Icon, action, badge: () => 4 };
    const tabItem = { id: 'overview' as const, labelKey: 'sidebar.overview', keywords: '', icon: Icon };

    const { rerender } = render(
      <SidebarNavItem item={actionItem} itemIndex={0} sidebarCollapsed={false} activeTab="overview" setActiveTab={setActiveTab} />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(action).toHaveBeenCalledOnce();
    expect(screen.getByText('4')).toBeTruthy();

    rerender(
      <SidebarNavItem item={tabItem} itemIndex={1} sidebarCollapsed={true} activeTab="overview" setActiveTab={setActiveTab} />,
    );
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(setActiveTab).toHaveBeenCalledWith('overview');
    expect(button.getAttribute('title')).toBe('sidebar.overview');
    expect(screen.queryByText('sidebar.overview')).toBeNull();
  });

  it('renders section badge branches and toggles collapsed state', () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <SidebarSectionHeader section={section} isSectionActive={false} isSectionCollapsed={false} headingId="tools" sectionBadge={null} onToggle={onToggle} />,
    );
    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledOnce();

    rerender(
      <SidebarSectionHeader section={section} isSectionActive={true} isSectionCollapsed={true} headingId="tools" sectionBadge={7} onToggle={onToggle} />,
    );
    expect(screen.getByText('7')).toBeTruthy();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByText('7').className).toContain('bg-emerald');

    rerender(
      <SidebarSectionHeader section={section} isSectionActive={false} isSectionCollapsed={false} headingId="tools" sectionBadge={undefined} onToggle={onToggle} />,
    );
    expect(screen.queryByText('7')).toBeNull();

    rerender(
      <SidebarSectionHeader section={section} isSectionActive={false} isSectionCollapsed={false} headingId="tools" sectionBadge={3} onToggle={onToggle} />,
    );
    expect(screen.getByText('3').className).toContain('bg-slate-800');
  });

  it('handles null project keys and bounds persisted navigation search', () => {
    expect(navigationSearchKey(null)).toBeNull();
    expect(readNavigationSearch(null)).toBe('');
    persistNavigationSearch(null, 'ignored');
    expect(localStorage.length).toBe(0);

    const value = 'x'.repeat(130);
    persistNavigationSearch('project-1', value);
    expect(localStorage.getItem('seomi_project_project-1_sidebar_search_v1')).toHaveLength(120);
    expect(readNavigationSearch('project-1')).toHaveLength(120);
    expect(sectionId('tools')).toBe('sidebar-section-tools');
    expect(pageAuditTabIds).toContain('performance');
  });
});
