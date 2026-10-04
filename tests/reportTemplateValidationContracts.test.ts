import { beforeEach, expect, it, vi } from 'vitest';
import {
  DEFAULT_CRAWL_REPORT_TEMPLATE as defaults, loadCrawlReportTemplates,
  saveCrawlReportTemplate, loadSelectedCrawlReportTemplateId,
} from '@/services/reportTemplates';

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
const key = 'seomi_project_one_report_templates_v1';
const input = { name: 'QA', sections: ['issues'] as const };
const candidate = { id: 'report-qa', name: ' QA ', sections: ['issues', 'issues', 'unknown', 1] };

it.each(['', 'x', 'bad/id', 'a'.repeat(81), defaults.id])('rejects unusable or reserved explicit ID %s before storage writes', id => {
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  expect(() => saveCrawlReportTemplate('one', { ...input, sections: ['issues'], id })).toThrow();
  expect(writes).not.toHaveBeenCalled();
  expect(loadCrawlReportTemplates('one')).toEqual([defaults]);
});

it('accepts a valid explicit ID and preserves identity and creation time on update', () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date('2026-10-01T12:00:00Z'));
    const first = saveCrawlReportTemplate('one', { name: ' First ', sections: ['issues'], id: 'REPORT_qa-1' });
    vi.setSystemTime(new Date('2026-10-02T12:00:00Z'));
    const second = saveCrawlReportTemplate('one', { name: ' Second ', sections: ['summary'], id: first.id });
    expect(second).toEqual({ ...first, name: 'Second', sections: ['summary'], updatedAt: '2026-10-02T12:00:00.000Z' });
    expect(first.createdAt).toBe('2026-10-01T12:00:00.000Z');
    expect(loadCrawlReportTemplates('one')).toEqual([defaults, second]);
  } finally { vi.useRealTimers(); }
});

it.each([null, 1, 'text', {}, [], { ...candidate, id: '/' }, { ...candidate, id: defaults.id },
  { ...candidate, name: 42 }, { ...candidate, name: ' ' }, { ...candidate, sections: null },
  { ...candidate, sections: ['unknown'] }])('drops malformed persisted template %j', value => {
  localStorage.setItem(key, JSON.stringify([value]));
  expect(loadCrawlReportTemplates('one')).toEqual([defaults]);
});

it.each(['null', '{}', '"text"', 'invalid-json'])('recovers from malformed catalog %s', value => {
  localStorage.setItem(key, value);
  expect(loadCrawlReportTemplates('one')).toEqual([defaults]);
});

it('normalizes name and unique supported sections and supplies absent timestamps', () => {
  localStorage.setItem(key, JSON.stringify([candidate]));
  const template = loadCrawlReportTemplates('one')[1];
  expect(template).toMatchObject({ id: candidate.id, name: 'QA', sections: ['issues'] });
  expect(Number.isFinite(Date.parse(template.createdAt))).toBe(true);
  expect(template.updatedAt).toBe(template.createdAt);
});

it('bounds name and catalog size while keeping newest templates first', () => {
  for (let index = 0; index < 21; index++) {
    saveCrawlReportTemplate('one', { id: `report-${index}`, name: 'a'.repeat(81), sections: ['issues'] });
  }
  const templates = loadCrawlReportTemplates('one');
  expect(templates).toHaveLength(21);
  expect(templates[0]).toEqual(defaults);
  expect(templates.slice(1).map(t => t.id)).toEqual(Array.from({ length: 20 }, (_, i) => `report-${20 - i}`));
  expect(templates.slice(1).every(t => t.name.length === 80)).toBe(true);
});

it('falls back from a stale stored selection without rewriting another project', () => {
  localStorage.setItem('seomi_project_one_report_template_selection_v1', 'deleted');
  expect(loadSelectedCrawlReportTemplateId('one')).toBe(defaults.id);
  expect(loadSelectedCrawlReportTemplateId(null)).toBe(defaults.id);
  expect(localStorage.getItem('seomi_project_one_report_template_selection_v1')).toBe('deleted');
  expect(loadCrawlReportTemplates('two')).toEqual([defaults]);
});
