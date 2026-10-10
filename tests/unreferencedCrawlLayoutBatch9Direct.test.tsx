import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CrawlResultsContent } from '@/components/Domain/crawlResults/CrawlResultsContent';
import { CrawlResultsGroups } from '@/components/Domain/crawlResults/CrawlResultsGroups';
import { CrawlResultsHeader } from '@/components/Domain/crawlResults/CrawlResultsHeader';
import { CrawlResultsNavigation } from '@/components/Domain/crawlResults/CrawlResultsNavigation';
import { CrawlPagesTable } from '@/components/Domain/siteAudit/runResults/CrawlPagesTable';
import { CrawlReportTemplateSection } from '@/components/Domain/siteAudit/runResults/CrawlReportTemplateSection';
import { useCrawlResultsSession } from '@/components/Domain/crawlResults/useCrawlResultsSession';
import type { useSiteAuditSession } from '@/components/Domain/siteAudit/useSiteAuditSession';
import { result, run } from './fixtures/crawlResultsTabsContracts';

type CrawlSession = ReturnType<typeof useCrawlResultsSession>;
type AuditSession = ReturnType<typeof useSiteAuditSession>;

function Harness({ renderChild }: { renderChild: (session: CrawlSession) => React.ReactNode }) {
  const session = useCrawlResultsSession({
    result,
    runs: [run],
    selectedRun: run,
    onSelectRun: vi.fn(),
  });
  return <>{renderChild(session)}</>;
}

const mockAuditSession = {
  t: (k: string) => k,
  filteredPages: result.pages,
  expandedRows: {},
  toggleRow: vi.fn(),
  selectedRun: run,
  selectedReportTemplate: { id: 'default', name: 'Default', builtIn: true },
  reportTemplates: [],
  reportTemplateName: '',
  reportTemplateError: null,
  reportTemplateSectionLabels: {},
  reportTemplateSections: ['overview'],
  selectReportTemplate: vi.fn(),
  setReportTemplateName: vi.fn(),
  createReportTemplate: vi.fn(),
  removeReportTemplate: vi.fn(),
  toggleReportTemplateSection: vi.fn(),
} as unknown as AuditSession;

describe('unreferenced crawl layout batch 9 direct assertions', () => {
  it('renders CrawlResultsContent directly', () => {
    const { container } = render(
      <Harness renderChild={(session) => <CrawlResultsContent session={session} />} />,
    );
    expect(container.textContent).toContain('80');
  });

  it('renders CrawlResultsGroups directly', () => {
    const { container } = render(
      <Harness renderChild={(session) => <CrawlResultsGroups session={session} />} />,
    );
    const groups = container.querySelectorAll('button[aria-pressed]');
    expect(groups.length).toBeGreaterThan(0);
    fireEvent.click(groups[1]);
    expect(groups[1].getAttribute('aria-pressed')).toBe('true');
    expect(groups[0].getAttribute('aria-pressed')).toBe('false');
  });

  it('renders CrawlResultsHeader directly', () => {
    const { container } = render(
      <Harness renderChild={(session) => <CrawlResultsHeader session={session} />} />,
    );
    expect(container.textContent).toContain('https://example.com/');
  });

  it('renders CrawlResultsNavigation directly', () => {
    const { container } = render(
      <Harness renderChild={(session) => <CrawlResultsNavigation session={session} />} />,
    );
    expect(screen.getByRole('combobox')).toBeTruthy();
    expect(container.querySelectorAll('option').length).toBeGreaterThan(0);
  });

  it('renders CrawlPagesTable directly', () => {
    render(<CrawlPagesTable session={mockAuditSession} />);
    expect(screen.getByText('https://example.com/')).toBeTruthy();
    expect(screen.getByText('https://example.com/missing')).toBeTruthy();
  });

  it('renders CrawlReportTemplateSection directly', () => {
    const toggleReportTemplateSection = vi.fn();
    const { container } = render(<CrawlReportTemplateSection session={{ ...mockAuditSession, toggleReportTemplateSection } as AuditSession} />);
    expect(container.querySelector('summary')?.textContent).toContain('siteAudit.reportTemplate');
    expect(container.querySelector('input[type="checkbox"]')).not.toBeNull();
    expect(container.querySelector('fieldset')?.getAttribute('aria-describedby')).toBe('crawl-report-template-description');
    expect(container.querySelector('#crawl-report-template-description')?.textContent).toContain('siteAudit.reportTemplateHelp');
    const help = container.querySelector('#crawl-report-template-help > summary')!;
    expect(container.querySelector('#crawl-report-template-help')?.hasAttribute('open')).toBe(false);
    fireEvent.click(help);
    expect(container.querySelector('#crawl-report-template-help')?.hasAttribute('open')).toBe(true);
    expect(container.querySelector('#crawl-report-template-help-description')?.textContent).toContain('siteAudit.reportTemplateHelp');
    fireEvent.click(container.querySelector('input[type="checkbox"]')!);
    expect(toggleReportTemplateSection).toHaveBeenCalledWith('configuration');
  });
});
