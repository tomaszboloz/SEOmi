import { beforeEach, expect, it, vi } from 'vitest';
import { downloadCrawlPdf } from '@/services/export/crawlReport';
import { saveOffPageHistory } from '@/services/offPage/history';
import { DEFAULT_CRAWL_REPORT_TEMPLATE, type ReportTemplateSection } from '@/services/reportTemplates';
import { createCrawlRunFixture } from './fixtures/crawl';
import { historyRecord } from './fixtures/offPageHistory';

const { downloadPdf } = vi.hoisted(() => ({ downloadPdf: vi.fn() }));
vi.mock('@/services/export/download', () => ({ downloadPdf, downloadText: vi.fn() }));

const run = createCrawlRunFixture({ projectId: 'report-project' });
const template = (sections: ReportTemplateSection[]) => ({ ...DEFAULT_CRAWL_REPORT_TEMPLATE, sections });
beforeEach(() => { localStorage.clear(); downloadPdf.mockReset(); });

it.each([undefined, template(['summary', 'offPage'])])('includes saved off-page evidence when the template permits it', async (selected) => {
  saveOffPageHistory('report-project', historyRecord());
  await downloadCrawlPdf(run, selected);
  expect(downloadPdf).toHaveBeenCalledWith('generate_crawl_pdf', {
    run: expect.objectContaining({
      result: run.result, report_template_sections: selected?.sections ?? null,
      offPage: expect.objectContaining({ sources_requested: 1, tbva: { value: 0.8, status: 'ready', limitations: [] } }),
    }),
  }, expect.stringMatching(/-report\.pdf$/));
});

it.each([undefined, template(['summary', 'offPage']), template(['summary'])])('does not send an empty off-page field without saved evidence', async (selected) => {
  await downloadCrawlPdf(run, selected);
  expect(downloadPdf.mock.calls[0][1].run).not.toHaveProperty('offPage');
});

it('omits saved evidence when explicitly excluded and does not consult its storage', async () => {
  saveOffPageHistory('report-project', historyRecord());
  const getItem = vi.spyOn(Storage.prototype, 'getItem');
  await downloadCrawlPdf(run, template(['summary']));
  expect(downloadPdf.mock.calls[0][1].run).not.toHaveProperty('offPage');
  expect(getItem).not.toHaveBeenCalledWith('seomi_project_report-project_offpage_history_v1');
  getItem.mockRestore();
});

it('does not borrow evidence from another project or a run without a project', async () => {
  saveOffPageHistory('another-project', historyRecord());
  await downloadCrawlPdf(run);
  await downloadCrawlPdf(createCrawlRunFixture());
  for (const call of downloadPdf.mock.calls) expect(call[1].run).not.toHaveProperty('offPage');
});
