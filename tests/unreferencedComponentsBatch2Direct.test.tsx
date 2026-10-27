import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderLighthouseDescription } from '@/components/Performance/pagespeed/PageSpeedHelpers';
import { SidebarSearchField } from '@/components/Layout/sidebar/SidebarSearchField';
import { SidebarNavSectionComponent } from '@/components/Layout/sidebar/SidebarNavSection';
import { DomainOverviewHeader } from '@/components/Domain/domainOverview/DomainOverviewHeader';
import type { DomainOverviewSession } from '@/components/Domain/domainOverview/useDomainOverviewSession';

describe('unreferenced components batch 2 direct assertions', () => {
  it('renderLighthouseDescription converts markdown links into anchor elements', () => {
    const { container } = render(
      <div>{renderLighthouseDescription('Check [Google](https://google.com) for details.')}</div>,
    );
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('https://google.com');
    expect(link?.textContent).toBe('Google');
  });

  it('SidebarSearchField renders search input and handles query update', () => {
    const update = vi.fn();
    render(<SidebarSearchField navQuery="audit" updateNavQuery={update} />);

    const input = screen.getByRole('textbox');
    expect((input as HTMLInputElement).value).toBe('audit');
    fireEvent.change(input, { target: { value: 'crawl' } });
    expect(update).toHaveBeenCalledWith('crawl');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(update).toHaveBeenCalledWith('');

    const clearBtn = screen.getByRole('button', { name: /clear/i });
    fireEvent.click(clearBtn);
    expect(update).toHaveBeenCalledWith('');
  });


  it('SidebarNavSectionComponent renders section with items', () => {
    const setActiveTab = vi.fn();
    const onToggle = vi.fn();
    const section: any = {
      key: 'general',
      titleKey: 'sidebar.general',
      items: [{ id: 'overview', labelKey: 'sidebar.overview', icon: () => null }],
    };

    const { container } = render(
      <SidebarNavSectionComponent
        section={section}
        isSectionActive={true}
        isSectionCollapsed={false}
        sidebarCollapsed={false}
        activeTab="overview"
        setActiveTab={setActiveTab}
        onToggle={onToggle}
      />,
    );

    expect(container.querySelector('section')?.textContent).toMatch(/overview/i);
    const itemButton = container.querySelector('[data-sidebar-tab="overview"]');
    expect(itemButton).not.toBeNull();
    fireEvent.click(itemButton!);
    expect(setActiveTab).toHaveBeenCalledWith('overview');
    const sectionButton = screen.getByRole('button', { name: /sidebar\.general/i });
    expect(sectionButton.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(sectionButton);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('DomainOverviewHeader renders title, input, and handles interactions', () => {
    const handleAnalyze = vi.fn();
    const handleNavigateBacklinks = vi.fn();
    const handleNavigateSiteAudit = vi.fn();
    const setInputDomain = vi.fn();

    const session = {
      t: ((k: string) => k) as any,
      inputDomain: 'example.com',
      setInputDomain,
      domainCountry: 'PL',
      setDomainCountry: vi.fn(),
      domainLanguage: 'pl',
      setDomainLanguage: vi.fn(),
      domainOverview: { metrics: {} } as any,
      history: [],
      isLoading: false,
      error: 'Sample error message',
      handleAnalyze,
      handleNavigateBacklinks,
      handleNavigateSiteAudit,
    } as unknown as DomainOverviewSession;

    const { rerender } = render(<DomainOverviewHeader session={session} />);
    expect(screen.getByText('domainResearchUi.title')).toBeDefined();
    expect(screen.getByText('Sample error message')).toBeDefined();

    fireEvent.click(screen.getByText('domainResearchUi.backlinkProfile'));
    expect(handleNavigateBacklinks).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByText('domainResearchUi.runCrawler'));
    expect(handleNavigateSiteAudit).toHaveBeenCalledOnce();
    expect(screen.getByDisplayValue('example.com')).toBeTruthy();

    const input = screen.getByPlaceholderText('domainResearchUi.domainPlaceholder');
    fireEvent.change(input, { target: { value: 'new.com' } });
    expect(setInputDomain).toHaveBeenCalledWith('new.com');

    fireEvent.submit(input.closest('form')!);
    expect(handleAnalyze).toHaveBeenCalledOnce();

    rerender(<DomainOverviewHeader session={{ ...session, isLoading: true, error: null } as any} />);
    expect(screen.getByText('domainResearchUi.scanning')).toBeDefined();

    const locInput = screen.getByRole('combobox', { name: 'dataforseo.locationLabel' });
    fireEvent.focus(locInput);
    const options = screen.getAllByRole('option');
    if (options.length > 0) {
      fireEvent.click(options[0]);
      expect(session.setDomainCountry).toHaveBeenCalled();
    }
  });
});
