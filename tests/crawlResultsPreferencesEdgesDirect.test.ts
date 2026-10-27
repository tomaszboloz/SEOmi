import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  filterPresetsKey,
  loadFilterPresets,
  readCrawlLinkNavigationPreferences,
  readCrawlNavigationPreferences,
} from '@/components/Domain/crawlResults/helpers/crawlResultsPreferences';

beforeEach(() => localStorage.clear());

describe('crawl result preference edge contracts', () => {
  it('falls back for invalid navigation values while preserving safe defaults', () => {
    localStorage.setItem('navigation', JSON.stringify({
      activeTab: 'not-a-tab',
      metadataFacet: 'missing-title',
      validationQuery: 42,
      validationSeverity: 'Warning',
    }));

    expect(readCrawlNavigationPreferences('navigation')).toEqual({
      activeTab: 'overview',
      activeTabGroup: 'core',
      metadataFacet: 'missing-title',
      validationQuery: '',
      validationSeverity: 'Warning',
    });
  });

  it('rejects non-string link queries and treats an absent status as all', () => {
    localStorage.setItem('links', JSON.stringify({ query: 7, kind: 'internal' }));

    expect(readCrawlLinkNavigationPreferences('links')).toEqual({
      query: '',
      kind: 'internal',
      status: 'all',
      sort: 'source',
      descending: false,
    });
  });

  it('keeps valid filter presets and discards malformed entries', () => {
    localStorage.setItem(filterPresetsKey('project'), JSON.stringify([
      {
        id: 'healthy', name: 'Healthy', severity: 'Warning', errorKind: 'all',
        segment: '2xx', onlyProblems: false, query: 'docs', sort: 'url', descending: true,
      },
      { id: '', name: '', severity: 'invalid' },
    ]));

    expect(loadFilterPresets('project')).toEqual([{
      id: 'healthy', name: 'Healthy', severity: 'Warning', errorKind: 'all',
      segment: '2xx', onlyProblems: false, query: 'docs', sort: 'url', descending: true,
    }]);
  });

  it('falls back to empty navigation preferences on storage read exception', async () => {
    const storage = await import('@/services/storage');
    const spy = vi.spyOn(storage, 'readJsonStorage').mockImplementationOnce(() => {
      throw new Error('corrupted');
    });
    expect(readCrawlNavigationPreferences('nav-key')).toEqual({
      activeTab: 'overview',
      activeTabGroup: 'core',
      metadataFacet: 'all',
      validationQuery: '',
      validationSeverity: 'all',
    });
    spy.mockRestore();
  });

  it('handles non-array filter presets and read exceptions gracefully', async () => {
    localStorage.setItem(filterPresetsKey('project-not-arr'), JSON.stringify({ not: 'array' }));
    expect(loadFilterPresets('project-not-arr')).toEqual([]);

    const storage = await import('@/services/storage');
    const spy = vi.spyOn(storage, 'readJsonStorage').mockImplementationOnce(() => {
      throw new Error('corrupted');
    });
    expect(loadFilterPresets('project-err')).toEqual([]);
    spy.mockRestore();
  });
});
