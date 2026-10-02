export type SeoToolId =
  | 'competitor-analysis'
  | 'competitor-keywords'
  | 'keyword-generator'
  | 'serp-simulator'
  | 'domain-age'
  | 'spam-score'
  | 'traffic-checker';

export const toolIds: readonly SeoToolId[] = [
  'competitor-analysis',
  'competitor-keywords',
  'keyword-generator',
  'serp-simulator',
  'domain-age',
  'spam-score',
  'traffic-checker',
];

export const tabStorageKey = (projectId: string) =>
  `seomi_project_${projectId}_seo_tools_tab_v1`;

export const simulatorStorageKey = (projectId: string) =>
  `seomi_project_${projectId}_seo_simulator_v1`;

export const domainAgeInputStorageKey = (projectId: string) =>
  `seomi_project_${projectId}_seo_domain_age_input_v1`;

export const competitorKeywordsInputStorageKey = (projectId: string) =>
  `seomi_project_${projectId}_seo_competitor_keywords_input_v1`;

export const isSeoToolId = (value: string | null): value is SeoToolId =>
  Boolean(value && toolIds.includes(value as SeoToolId));

export interface RdapEvent {
  eventAction: string;
  eventDate: string;
}

export interface RdapDomain {
  ldhName?: string;
  status?: string[];
  events?: RdapEvent[];
  links?: Array<{ href?: string }>;
}

export const domainFromInput = (value: string): string => {
  const trimmed = value.trim();
  const parsed = new URL(
    /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
  );
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  )
    throw new Error('invalid');
  const hostname = parsed.hostname
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/\.$/, '');
  if (
    !hostname ||
    hostname === 'localhost' ||
    !hostname.includes('.') ||
    hostname.includes(':')
  )
    throw new Error('invalid');
  return hostname;
};

export const ageInDays = (date: string): number | null => {
  const parsed = Date.parse(date);
  if (!Number.isFinite(parsed) || parsed > Date.now()) return null;
  return Math.floor((Date.now() - parsed) / 86_400_000);
};
