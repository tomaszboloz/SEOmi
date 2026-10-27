import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import * as storage from '@/services/storage';
import {
  DEFAULT_CRAWL_REPORT_TEMPLATE,
  deleteCrawlReportTemplate,
  loadCrawlReportTemplates,
  loadSelectedCrawlReportTemplateId,
  saveCrawlReportTemplate,
  saveSelectedCrawlReportTemplateId,
} from '@/services/reportTemplates';

describe('report templates edge cases and storage failure contracts', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updates built-in template name when language changes', async () => {
    await i18n.changeLanguage('pl');
    expect(DEFAULT_CRAWL_REPORT_TEMPLATE.name).toBe(i18n.t('runtimeErrors.reportTemplates.builtInName'));
    await i18n.changeLanguage('en');
    expect(DEFAULT_CRAWL_REPORT_TEMPLATE.name).toBe(i18n.t('runtimeErrors.reportTemplates.builtInName'));
  });

  it('rejects invalid template ids and empty inputs on save', () => {
    expect(() => saveCrawlReportTemplate('p1', { id: 'invalid/id!', name: 'Valid', sections: ['summary'] })).toThrow(
      i18n.t('runtimeErrors.reportTemplates.saveFailed'),
    );
    expect(() => saveCrawlReportTemplate('p1', { id: DEFAULT_CRAWL_REPORT_TEMPLATE.id, name: 'Valid', sections: ['summary'] })).toThrow(
      i18n.t('runtimeErrors.reportTemplates.saveFailed'),
    );
    expect(() => saveCrawlReportTemplate('p1', { name: '', sections: ['summary'] })).toThrow(
      i18n.t('runtimeErrors.reportTemplates.nameRequired'),
    );
    expect(() => saveCrawlReportTemplate('p1', { name: 'Valid', sections: [] })).toThrow(
      i18n.t('runtimeErrors.reportTemplates.sectionRequired'),
    );
  });

  it('updates an existing template while preserving its creation timestamp', () => {
    const created = saveCrawlReportTemplate('p1', { name: 'Original', sections: ['summary'] });
    const updated = saveCrawlReportTemplate('p1', { id: created.id, name: 'Renamed', sections: ['issues', 'summary'] });
    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Renamed');
    expect(updated.createdAt).toBe(created.createdAt);
  });

  it('throws when storage write fails on save or delete or select', () => {
    vi.spyOn(storage, 'writeJsonStorage').mockReturnValue(false);
    expect(() => saveCrawlReportTemplate('p1', { name: 'Fails', sections: ['summary'] })).toThrow(
      i18n.t('runtimeErrors.reportTemplates.saveFailed'),
    );

    const created = { id: 'custom-1', name: 'Custom', sections: ['summary' as const], createdAt: 'now', updatedAt: 'now' };
    vi.spyOn(storage, 'readJsonStorage').mockReturnValue([created]);
    expect(() => deleteCrawlReportTemplate('p1', 'custom-1')).toThrow(
      i18n.t('runtimeErrors.reportTemplates.saveFailed'),
    );

    vi.spyOn(storage, 'writeJsonStorage').mockReturnValue(true);
    vi.spyOn(storage, 'readStorage').mockReturnValue('custom-1');
    vi.spyOn(storage, 'removeStorage').mockReturnValue(false);
    expect(() => deleteCrawlReportTemplate('p1', 'custom-1')).toThrow(
      i18n.t('runtimeErrors.reportTemplates.saveFailed'),
    );

    vi.spyOn(storage, 'writeStorage').mockReturnValue(false);
    expect(() => saveSelectedCrawlReportTemplateId('p1', 'custom-1')).toThrow(
      i18n.t('runtimeErrors.reportTemplates.saveFailed'),
    );
  });

  it('handles load and selection fallbacks when storage is corrupt or empty', () => {
    const throwingArray = [{ get id() { throw new Error('normalize fail'); } }];
    vi.spyOn(storage, 'readJsonStorage').mockReturnValue(throwingArray);
    expect(loadCrawlReportTemplates('p1')).toEqual([DEFAULT_CRAWL_REPORT_TEMPLATE]);
    expect(loadSelectedCrawlReportTemplateId(null)).toBe(DEFAULT_CRAWL_REPORT_TEMPLATE.id);

    // Ignored selection when templateId is not valid in project
    saveSelectedCrawlReportTemplateId('p1', 'nonexistent-id');
  });
});
