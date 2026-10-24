import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import i18n from '@/i18n';
import { CrawlReportTemplateSection } from '@/components/Domain/siteAudit/runResults/CrawlReportTemplateSection';
import { useCrawlTemplates } from '@/components/Domain/siteAudit/session/useCrawlTemplates';
import type { useSiteAuditSession } from '@/components/Domain/siteAudit/useSiteAuditSession';
import { DEFAULT_CRAWL_REPORT_TEMPLATE, loadCrawlReportTemplates } from '@/services/reportTemplates';
import { createCrawlRunFixture } from './fixtures/crawl';

beforeEach(async () => { localStorage.clear(); await i18n.changeLanguage('en'); });

it('offers a translated off-page checkbox that toggles the optional template section', () => {
  const Harness = () => {
    const templates = useCrawlTemplates('project');
    const session = { ...templates, selectedRun: createCrawlRunFixture(), t: i18n.t.bind(i18n) } as ReturnType<typeof useSiteAuditSession>;
    return <CrawlReportTemplateSection session={session} />;
  };
  render(<Harness />);
  const checkbox = screen.getByRole<HTMLInputElement>('checkbox', { name: 'Off-page analysis' });
  expect(checkbox.checked).toBe(true);
  fireEvent.click(checkbox);
  expect(checkbox.checked).toBe(false);
  fireEvent.click(checkbox);
  expect(checkbox.checked).toBe(true);
});

it('round-trips offPage in saved templates without changing older explicit selections', () => {
  const { result } = renderHook(() => useCrawlTemplates('project'));
  expect(result.current.reportTemplateSectionLabels.offPage).toBe('Off-page analysis');
  expect(DEFAULT_CRAWL_REPORT_TEMPLATE.sections).toContain('offPage');
  localStorage.setItem('seomi_project_project_report_templates_v1', JSON.stringify([
    { id: 'old-template', name: 'Old template', sections: ['summary', 'aio'] },
    { id: 'offpage-template', name: 'Off-page', sections: ['summary', 'offPage'] },
  ]));
  const templates = loadCrawlReportTemplates('project');
  expect(templates.find((template) => template.id === 'old-template')?.sections).toEqual(['summary', 'aio']);
  expect(templates.find((template) => template.id === 'offpage-template')?.sections).toEqual(['summary', 'offPage']);
});
