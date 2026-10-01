export const REPORT_TEMPLATE_SECTIONS = [
  'summary',
  'configuration',
  'pages',
  'issues',
  'links',
  'images',
  'resources',
  'frames',
  'custom-search',
  'semantic',
] as const;
import { readJsonStorage, readStorage, removeStorage, writeJsonStorage, writeStorage } from '@/services/storage';
import i18n from '@/i18n';

export type ReportTemplateSection = typeof REPORT_TEMPLATE_SECTIONS[number];

export interface CrawlReportTemplate {
  id: string;
  name: string;
  sections: ReportTemplateSection[];
  createdAt: string;
  updatedAt: string;
  builtIn?: boolean;
}

const storageKey = (projectId: string) => `seomi_project_${projectId}_report_templates_v1`;
const selectionKey = (projectId: string) => `seomi_project_${projectId}_report_template_selection_v1`;

const defaultSections = [...REPORT_TEMPLATE_SECTIONS];

export const DEFAULT_CRAWL_REPORT_TEMPLATE: CrawlReportTemplate = {
  id: 'site-health',
  name: i18n.t('runtimeErrors.reportTemplates.builtInName'),
  sections: defaultSections,
  createdAt: '1970-01-01T00:00:00.000Z',
  updatedAt: '1970-01-01T00:00:00.000Z',
  builtIn: true,
};

i18n.on('languageChanged', () => {
  DEFAULT_CRAWL_REPORT_TEMPLATE.name = i18n.t('runtimeErrors.reportTemplates.builtInName');
});

const isSection = (value: unknown): value is ReportTemplateSection =>
  typeof value === 'string' && (REPORT_TEMPLATE_SECTIONS as readonly string[]).includes(value);

const normalizeSections = (value: unknown): ReportTemplateSection[] => {
  const sections = Array.isArray(value) ? value.filter(isSection) : [];
  return Array.from(new Set(sections));
};

const normalizeTemplate = (value: unknown): CrawlReportTemplate | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<CrawlReportTemplate>;
  if (typeof candidate.id !== 'string' || !/^[a-z0-9][a-z0-9_-]{1,79}$/i.test(candidate.id)) return null;
  if (candidate.id === DEFAULT_CRAWL_REPORT_TEMPLATE.id) return null;
  const name = typeof candidate.name === 'string' ? candidate.name.trim().slice(0, 80) : '';
  const sections = normalizeSections(candidate.sections);
  if (!name || sections.length === 0) return null;
  const now = new Date().toISOString();
  return {
    id: candidate.id,
    name,
    sections,
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : now,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : now,
  };
};

export const loadCrawlReportTemplates = (projectId: string | null): CrawlReportTemplate[] => {
  if (!projectId) return [DEFAULT_CRAWL_REPORT_TEMPLATE];
  const parsed = readJsonStorage(storageKey(projectId), []);
  try {
    const custom = Array.isArray(parsed)
      ? parsed.map(normalizeTemplate).filter((template): template is CrawlReportTemplate => Boolean(template))
      : [];
    return [DEFAULT_CRAWL_REPORT_TEMPLATE, ...custom];
  } catch {
    return [DEFAULT_CRAWL_REPORT_TEMPLATE];
  }
};

export const saveCrawlReportTemplate = (
  projectId: string,
  input: { id?: string; name: string; sections: ReportTemplateSection[] },
): CrawlReportTemplate => {
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new Error(i18n.t('runtimeErrors.reportTemplates.nameRequired'));
  const sections = normalizeSections(input.sections);
  if (!sections.length) throw new Error(i18n.t('runtimeErrors.reportTemplates.sectionRequired'));
  const now = new Date().toISOString();
  const existing = loadCrawlReportTemplates(projectId).find((template) => template.id === input.id && !template.builtIn);
  const template: CrawlReportTemplate = {
    id: existing?.id || input.id || `report-${globalThis.crypto?.randomUUID?.() || Date.now().toString(36)}`,
    name,
    sections,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  const custom = loadCrawlReportTemplates(projectId)
    .filter((candidate) => !candidate.builtIn && candidate.id !== template.id);
  if (!writeJsonStorage(storageKey(projectId), [template, ...custom].slice(0, 20))) {
    throw new Error(i18n.t('runtimeErrors.reportTemplates.saveFailed'));
  }
  return template;
};

export const deleteCrawlReportTemplate = (projectId: string, templateId: string): void => {
  if (!templateId || templateId === DEFAULT_CRAWL_REPORT_TEMPLATE.id) return;
  const custom = loadCrawlReportTemplates(projectId).filter((template) => !template.builtIn && template.id !== templateId);
  writeJsonStorage(storageKey(projectId), custom);
  if (readStorage(selectionKey(projectId)) === templateId) removeStorage(selectionKey(projectId));
};

export const loadSelectedCrawlReportTemplateId = (projectId: string | null): string => {
  if (!projectId) return DEFAULT_CRAWL_REPORT_TEMPLATE.id;
  const selected = readStorage(selectionKey(projectId));
  return loadCrawlReportTemplates(projectId).some((template) => template.id === selected)
    ? selected || DEFAULT_CRAWL_REPORT_TEMPLATE.id
    : DEFAULT_CRAWL_REPORT_TEMPLATE.id;
};

export const saveSelectedCrawlReportTemplateId = (projectId: string, templateId: string): void => {
  const valid = loadCrawlReportTemplates(projectId).some((template) => template.id === templateId);
  if (!valid) return;
  writeStorage(selectionKey(projectId), templateId);
};
