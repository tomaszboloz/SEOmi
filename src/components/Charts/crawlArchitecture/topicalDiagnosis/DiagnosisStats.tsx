import { useTranslation } from 'react-i18next';
import type { DiagnosisStats as Stats } from '@/services/topicalDiagnosis';

export const DiagnosisStats = ({ stats }: { stats: Stats }) => {
  const { t } = useTranslation();
  const entries: Array<[string, string | number]> = [
    ['documents', stats.documents],
    ['pages', stats.pages],
    ['skipped', stats.skippedPages],
    ['hubs', stats.hubs],
    ['topics', stats.topics],
    ['singletons', stats.singletons],
    ['mergedPairs', stats.mergedPairs],
    ['languages', stats.languages.join(', ') || '—'],
  ];
  return (
    <dl className="flex flex-wrap gap-2 text-[11px]" aria-label={t('topicalDiagnosis.title')}>
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-md border border-slate-700 bg-slate-950/50 px-2 py-1 text-slate-300">
          <dt className="inline text-slate-500">{t(`topicalDiagnosis.stats.${key}`)}: </dt>
          <dd className="inline font-medium text-slate-100">{value}</dd>
        </div>
      ))}
    </dl>
  );
};
