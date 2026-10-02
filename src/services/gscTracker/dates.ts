import i18n from '@/i18n';
import type { GscDateRange } from './types';

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

export const latestCompleteGscDateRange = (now = new Date()): GscDateRange => {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 3));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 27);
  return { startDate: isoDate(start), endDate: isoDate(end) };
};

export const validateGscDateRange = (range: GscDateRange, now = new Date()): string | null => {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && isoDate(parsed) === value;
  };
  if (!parse(range.startDate) || !parse(range.endDate)) return i18n.t('runtimeErrors.gsc.invalidDates');
  if (range.startDate > range.endDate) return i18n.t('runtimeErrors.gsc.order');
  const latestAvailable = latestCompleteGscDateRange(now).endDate;
  if (range.endDate > latestAvailable) return i18n.t('runtimeErrors.gsc.latest', { date: latestAvailable });
  return null;
};

