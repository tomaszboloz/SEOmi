import { useTranslation } from 'react-i18next';
import type { HssTrend } from '@/services/hss';

const signed = (value: number): string => `${value > 0 ? '+' : ''}${value}`;

/** Change vs the previous comparable run, in words as well as sign, so colour is never the only signal. */
export const ExecutiveTrend = ({ trend, value }: { trend: HssTrend | null; value: number | null | undefined }) => {
  const { t, i18n } = useTranslation();
  if (!trend) return <span className="text-slate-500">{t('executive.trend.first')}</span>;
  if (value === null || value === undefined) return <span className="text-slate-500">{t('executive.trend.notComparable')}</span>;
  const date = new Date(trend.previous.generatedAt).toLocaleDateString(i18n.language);
  const tone = value > 0 ? 'text-emerald-300' : value < 0 ? 'text-rose-300' : 'text-slate-300';
  const direction = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  return <span className={tone}>{t(`executive.trend.${direction}`, { value: signed(value), date })}</span>;
};
