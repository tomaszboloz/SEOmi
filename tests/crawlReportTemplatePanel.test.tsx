import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { CrawlReportTemplatePanel } from '@/components/Domain/siteAudit/CrawlReportTemplatePanel';
import { DEFAULT_CRAWL_REPORT_TEMPLATE, REPORT_TEMPLATE_SECTIONS } from '@/services/reportTemplates';
import { Session, session } from './fixtures/crawlSessionControlsContracts';

beforeEach(async () => { await i18n.changeLanguage('en'); });

it('lists optional report sections, reflects the selection and reports template errors', () => {
  const toggleReportTemplateSection = vi.fn();
  const value = session({ selectedReportTemplate: { ...DEFAULT_CRAWL_REPORT_TEMPLATE, name: 'Client brief' },
    reportTemplates: [DEFAULT_CRAWL_REPORT_TEMPLATE], reportTemplateName: '', reportTemplateSections: ['summary', 'pages'],
    reportTemplateSectionLabels: Object.fromEntries(REPORT_TEMPLATE_SECTIONS.map(section => [section, `label:${section}`])) as Session['reportTemplateSectionLabels'],
    reportTemplateError: 'template save failed', toggleReportTemplateSection, createReportTemplate: vi.fn(), removeReportTemplate: vi.fn(),
    selectReportTemplate: vi.fn(), setReportTemplateName: vi.fn() });
  render(<CrawlReportTemplatePanel session={value} />);
  expect(screen.getByText(/Client brief/)).toBeTruthy();
  expect(screen.queryByRole('checkbox', { name: 'label:summary', hidden: true })).toBeNull();
  expect((screen.getByRole('checkbox', { name: 'label:pages', hidden: true }) as HTMLInputElement).checked).toBe(true);
  expect((screen.getByRole('checkbox', { name: 'label:configuration', hidden: true }) as HTMLInputElement).checked).toBe(false);
  fireEvent.click(screen.getByRole('checkbox', { name: 'label:configuration', hidden: true }));
  expect(toggleReportTemplateSection).toHaveBeenCalledExactlyOnceWith('configuration');
  expect(screen.getByRole('alert', { hidden: true }).textContent).toBe('template save failed');
});
