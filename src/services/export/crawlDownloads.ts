import type { CrawlRunRecord } from '@/types';
import { downloadText } from './download';
import { crawlFilename } from './filenames';
import { crawlPagesCsv } from './crawlPages';
import { crawlLinksCsv, crawlImagesCsv, crawlCustomSearchCsv, crawlResourcesCsv, crawlFramesCsv, crawlIssuesCsv } from './crawlTables';

export const downloadCrawlPagesCsv = (run: CrawlRunRecord): void => downloadText(crawlFilename(run, 'urls', 'csv'), crawlPagesCsv(run), 'text/csv');
export const downloadCrawlLinksCsv = (run: CrawlRunRecord): void => downloadText(crawlFilename(run, 'links', 'csv'), crawlLinksCsv(run), 'text/csv');
export const downloadCrawlImagesCsv = (run: CrawlRunRecord): void => downloadText(crawlFilename(run, 'images', 'csv'), crawlImagesCsv(run), 'text/csv');
export const downloadCrawlCustomSearchCsv = (run: CrawlRunRecord): void => downloadText(crawlFilename(run, 'custom-search', 'csv'), crawlCustomSearchCsv(run), 'text/csv');
export const downloadCrawlResourcesCsv = (run: CrawlRunRecord): void => downloadText(crawlFilename(run, 'resources', 'csv'), crawlResourcesCsv(run), 'text/csv');
export const downloadCrawlFramesCsv = (run: CrawlRunRecord): void => downloadText(crawlFilename(run, 'frames', 'csv'), crawlFramesCsv(run), 'text/csv');
export const downloadCrawlIssuesCsv = (run: CrawlRunRecord): void => downloadText(crawlFilename(run, 'issues', 'csv'), crawlIssuesCsv(run), 'text/csv');
