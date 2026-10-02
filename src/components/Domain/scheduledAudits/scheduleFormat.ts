import type { AuditIntervalHours } from '@/services/auditSchedule';

export const intervalOptions: Array<{ hours: AuditIntervalHours; labelKey: string }> = [
  { hours: 6, labelKey: 'schedules.every6Hours' },
  { hours: 12, labelKey: 'schedules.every12Hours' },
  { hours: 24, labelKey: 'schedules.daily' },
  { hours: 168, labelKey: 'schedules.weekly' },
];

export const localDate = (value: string, language: string): string => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(date) : '—';
};
