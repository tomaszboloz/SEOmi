import i18n from '@/i18n';

export type AuditCheckStatus = 'pass' | 'warning' | 'error' | 'not_applicable';

export type AuditCheckCategory = string;

export interface LocalAuditCheck {
  id: string;
  label: string;
  category: AuditCheckCategory;
  status: AuditCheckStatus;
  evidence: string;
}

export const check = (
  id: string,
  category: AuditCheckCategory,
  label: string,
  status: AuditCheckStatus,
  evidence: string,
): LocalAuditCheck => ({
  id,
  category: i18n.t(`auditChecks.categories.${category}`),
  label: i18n.t(`auditChecks.labels.${label}`),
  status,
  evidence,
});

export const evidence = (key: string, variables?: Record<string, unknown>): string =>
  i18n.t(`auditChecks.evidence.${key}`, variables);

export const present = (value: unknown): boolean =>
  typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null;

export const absoluteHttp = (value?: string): boolean => /^https?:\/\/[^\s]+$/i.test(value || '');

export const uniqueCount = (items: string[]): number =>
  new Set(items.map((item) => item.trim().toLowerCase())).size;
