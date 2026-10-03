import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeCrawlResourceUrl } from '@/services/crawlResources';
import { isPageAuditTab, ALL_WORKSPACE_TABS } from '@/services/workspaceRoutes';
import { isWorkspaceDeepLinkTab } from '@/services/workspaceDeepLink';
import { pageSpeedHistoryStorageKey } from '@/services/pagespeedHistory';
import { parseBacklinkSnapshot } from '@/services/researchContracts';
import { crawlErrorLabel } from '@/services/crawlErrors';
import { isHttpSourceUrl } from '@/services/contentBrief';
import { downloadBlob } from '@/services/download';
import { measureSerpText } from '@/services/serpPreview';
import i18n from '@/i18n';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('public utility contracts', () => {
  it('normalizes HTTP resource identity without dropping query distinctions', () => {
    expect(normalizeCrawlResourceUrl(' HTTPS://EXAMPLE.COM:443/a?q=1#fragment ')).toBe('https://example.com/a?q=1');
    expect(normalizeCrawlResourceUrl('https://example.com/a?q=2')).not.toBe(normalizeCrawlResourceUrl('https://example.com/a?q=1'));
    expect(normalizeCrawlResourceUrl('data:image/png;base64,abc')).toBe('');
    expect(normalizeCrawlResourceUrl('javascript:alert(1)')).toBe('');
    expect(normalizeCrawlResourceUrl(' /relative.css ')).toBe('/relative.css');
  });

  it('accepts supported deep-link destinations and distinguishes page audit routes', () => {
    for (const tab of ALL_WORKSPACE_TABS) expect(isWorkspaceDeepLinkTab(tab)).toBe(true);
    expect(isWorkspaceDeepLinkTab(null)).toBe(false);
    expect(isWorkspaceDeepLinkTab('__proto__')).toBe(false);
    expect(isWorkspaceDeepLinkTab(' Overview ')).toBe(false);
    expect(isPageAuditTab('overview')).toBe(true);
    expect(isPageAuditTab('amp')).toBe(true);
    expect(isPageAuditTab('site-audit')).toBe(false);
    expect(isPageAuditTab('search-console')).toBe(false);
  });

  it('isolates the PageSpeed history namespace from other projects and tools', () => {
    expect(pageSpeedHistoryStorageKey('project-a')).toBe('seomi_project_project-a_pagespeed_history_v1');
    expect(pageSpeedHistoryStorageKey('project-b')).not.toBe(pageSpeedHistoryStorageKey('project-a'));
  });

  it('retains backlink zero and null evidence while rejecting corrupt snapshots', () => {
    const snapshot = {domain:'example.com',retrieved_at:'2026-10-01T00:00:00Z',total_backlinks:0,referring_domains:null,domain_rank:0,dofollow_ratio:null};
    expect(parseBacklinkSnapshot(snapshot)).toEqual(snapshot);
    for(const patch of [{domain:null},{total_backlinks:-1},{total_backlinks:1.5},{domain_rank:Infinity},{dofollow_ratio:101},{referring_domains:'0'}]) {
      expect(parseBacklinkSnapshot({...snapshot,...patch})).toBeNull();
    }
    expect(parseBacklinkSnapshot(null)).toBeNull();
    expect(parseBacklinkSnapshot([])).toBeNull();
  });

  it('localizes known crawl errors and preserves unknown provider categories visibly', () => {
    expect(crawlErrorLabel('timeout')).toBe(i18n.t('crawl.ui.errorKinds.timeout'));
    expect(crawlErrorLabel('proxy_failure')).toBe('PROXY_FAILURE');
  });

  it('limits editorial source references to parseable HTTP or HTTPS URLs', () => {
    expect(isHttpSourceUrl('https://example.com/source?q=1#citation')).toBe(true);
    expect(isHttpSourceUrl('http://example.com/source')).toBe(true);
    for(const url of ['', '/relative', 'not a url', 'file:///tmp/source', 'javascript:alert(1)', 'data:text/plain,source']) {
      expect(isHttpSourceUrl(url),url).toBe(false);
    }
  });

  it('downloads the supplied blob and defers revocation until the WebView can consume it', () => {
    vi.useFakeTimers();
    const create = vi.fn(() => 'blob:test-export');
    const revoke = vi.fn();
    vi.stubGlobal('URL', class extends URL { static createObjectURL = create; static revokeObjectURL = revoke; });
    let clicked: HTMLAnchorElement | null = null;
    vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(this: HTMLAnchorElement) { clicked = document.querySelector('a[download="report.csv"]'); expect(clicked).toBe(this); expect(this.isConnected).toBe(true); });
    const blob = new Blob(['evidence']);
    downloadBlob('report.csv',blob);
    expect(create).toHaveBeenCalledWith(blob);
    expect(clicked).toMatchObject({download:'report.csv',href:'blob:test-export',isConnected:false});
    expect(revoke).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:test-export');
  });

  it('releases export resources even if the download click fails', () => {
    vi.useFakeTimers();
    const revoke = vi.fn();
    vi.stubGlobal('URL', class extends URL { static createObjectURL = vi.fn(()=>'blob:failed-export'); static revokeObjectURL = revoke; });
    vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{throw new Error('download blocked');});
    expect(()=>downloadBlob('report.csv',new Blob(['evidence']))).toThrow('download blocked');
    expect(document.querySelector('a[download="report.csv"]')).toBeNull();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:failed-export');
  });

  it('uses measured browser text width with the requested font', () => {
    vi.spyOn(navigator,'userAgent','get').mockReturnValue('SEOmi WebView');
    const context = {font:'',measureText:vi.fn(()=>({width:123.5}))};
    vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    expect(measureSerpText('Measured title',20)).toBe(123.5);
    expect(context.font).toBe('20px Arial, sans-serif');
    expect(context.measureText).toHaveBeenCalledWith('Measured title');
  });

  it.each(['missing','blocked'])('falls back to a finite estimate when canvas is %s', (state) => {
    vi.spyOn(navigator,'userAgent','get').mockReturnValue('SEOmi WebView');
    vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation(()=>{if(state==='blocked')throw new Error('restricted canvas');return null;});
    expect(measureSerpText('',20)).toBe(0);
    expect(measureSerpText('WWW',20)).toBeGreaterThan(measureSerpText('iii',20));
    expect(measureSerpText('Żółć 日本語',20)).toBeGreaterThan(0);
    expect(measureSerpText('Title',40)).toBeCloseTo(2*measureSerpText('Title',20));
  });
});
