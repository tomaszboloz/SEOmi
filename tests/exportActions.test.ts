import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { downloadAuditJson, downloadAuditCsv, downloadAuditLinksCsv, downloadAuditImagesCsv, downloadBacklinkGapCsv, downloadCrawlJson, downloadCrawlPagesCsv, downloadCrawlLinksCsv, downloadCrawlImagesCsv, downloadCrawlCustomSearchCsv, downloadCrawlResourcesCsv, downloadCrawlFramesCsv, downloadCrawlIssuesCsv, downloadCrawlPdf } from '@/services/export';
import { invokeTauriCommand } from '@/services/tauri';
import type { BacklinkGapReport, CrawlRunRecord, PageAuditData } from '@/types';

vi.mock('@/services/tauri', () => ({invokeTauriCommand:vi.fn()}));
const audit = {final_url:'https://example.com',timestamp:'2026-10-01T12:00:00Z',http_status:200,response_time_ms:120,health_score:88,meta_tags:{title:'=unsafe'},headings:{h1_count:1},images:[],links:{total_links:0,links:[]},security_headers:{score:90},issues:[]} as unknown as PageAuditData;
const run = {id:'run-fixture',completedAt:'2026-10-01T12:00:00Z',startUrl:'https://example.com',config:{},result:{pages:[],resources:[]}} as unknown as CrawlRunRecord;
const gap = {target:'example.com',competitors:[],opportunities:[],include_subdomains:false,rows_scanned:0,total_rows:0} as BacklinkGapReport;
let clicked: string[];
beforeEach(() => {
  clicked=[];
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-01T12:00:00Z'));
  vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:report');
  vi.spyOn(URL,'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(this:HTMLAnchorElement){clicked.push(this.download);});
});
afterEach(() => {vi.runAllTimers();vi.restoreAllMocks();vi.useRealTimers();vi.mocked(invokeTauriCommand).mockReset();});

it.each([
  ['audit JSON',()=>downloadAuditJson(audit), /^seomi-audit-example.com-2026-10-01\.json$/, 'application/json;charset=utf-8'],
  ['audit CSV',()=>downloadAuditCsv(audit), /^seomi-audit-example.com-2026-10-01\.csv$/, 'text/csv;charset=utf-8'],
  ['audit links',()=>downloadAuditLinksCsv(audit), /-links\.csv$/, 'text/csv;charset=utf-8'],
  ['audit images',()=>downloadAuditImagesCsv(audit), /-images\.csv$/, 'text/csv;charset=utf-8'],
  ['backlink gap',()=>downloadBacklinkGapCsv(gap), /^seomi-backlink-gap-example.com-2026-10-01\.csv$/, 'text/csv;charset=utf-8'],
  ['crawl JSON',()=>downloadCrawlJson(run), /-report\.json$/, 'application/json;charset=utf-8'],
  ['crawl pages',()=>downloadCrawlPagesCsv(run), /-urls\.csv$/, 'text/csv;charset=utf-8'],
  ['crawl links',()=>downloadCrawlLinksCsv(run), /-links\.csv$/, 'text/csv;charset=utf-8'],
  ['crawl images',()=>downloadCrawlImagesCsv(run), /-images\.csv$/, 'text/csv;charset=utf-8'],
  ['crawl custom search',()=>downloadCrawlCustomSearchCsv(run), /-custom-search\.csv$/, 'text/csv;charset=utf-8'],
  ['crawl resources',()=>downloadCrawlResourcesCsv(run), /-resources\.csv$/, 'text/csv;charset=utf-8'],
  ['crawl frames',()=>downloadCrawlFramesCsv(run), /-frames\.csv$/, 'text/csv;charset=utf-8'],
  ['crawl issues',()=>downloadCrawlIssuesCsv(run), /-issues\.csv$/, 'text/csv;charset=utf-8'],
] as const)('downloads %s with a meaningful filename, correct MIME type and delayed cleanup', (_, action, filename, mime) => {
  action();
  expect(clicked).toHaveLength(1);
  expect(clicked[0]).toMatch(filename);
  const blob=vi.mocked(URL.createObjectURL).mock.calls[0][0];
  expect(blob).toBeInstanceOf(Blob);
  expect((blob as Blob).type).toBe(mime);
  expect((blob as Blob).size).toBeGreaterThan(0);
  expect(document.querySelector('a[download]')).toBeNull();
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  vi.runAllTimers();
  expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
});

it('passes the immutable crawl snapshot and template allow-list to native PDF generation', async () => {
  vi.mocked(invokeTauriCommand).mockResolvedValue(btoa('%PDF-fixture'));
  const template={id:'summary',name:'Summary only',sections:['summary'] as const,createdAt:'2026-10-01',updatedAt:'2026-10-01'};
  await downloadCrawlPdf(run,{...template,sections:[...template.sections]});
  expect(invokeTauriCommand).toHaveBeenCalledWith('generate_crawl_pdf',{run:expect.objectContaining({id:run.id,result:run.result,report_template_sections:['summary'],report_template_name:'Summary only'})});
  expect(vi.mocked(URL.createObjectURL).mock.calls[0][0]).toMatchObject({type:'application/pdf',size:12});
  expect(clicked[0]).toMatch(/-report\.pdf$/);
});

it('propagates native PDF errors without downloading an empty or successful-looking file', async () => {
  vi.mocked(invokeTauriCommand).mockRejectedValue(new Error('renderer unavailable'));
  await expect(downloadCrawlPdf(run)).rejects.toThrow('renderer unavailable');
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(clicked).toEqual([]);
});
