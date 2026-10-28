import { useTranslation } from 'react-i18next';
import type { JsonLdDiff } from '@/services/eeatTrust';

const show = (value: unknown): string => (typeof value === 'string' ? value : JSON.stringify(value));

/** Added/removed properties of the proposed graph compared with the graph observed in the crawl. */
export const TrustJsonLdDiff = ({ diff }: { diff: JsonLdDiff }) => {
  const { t } = useTranslation();
  const rows = [...diff.added.map((entry) => ({ ...entry, kind: 'added' as const })), ...diff.removed.map((entry) => ({ ...entry, kind: 'removed' as const }))];
  return (
    <div aria-label={t('trust.generator.diff.title')} role="group" className="space-y-1">
      <h3 className="text-xs font-semibold text-slate-200">{t('trust.generator.diff.title')}</h3>
      {rows.length === 0 ? <p className="text-xs text-slate-400">{t('trust.generator.diff.none')}</p> : (
        <ul className="space-y-0.5 text-[11px]">
          {rows.map((row) => (
            <li key={`${row.kind}:${row.id}:${row.property}`} className={row.kind === 'added' ? 'text-emerald-200' : 'text-rose-200'}>
              <span className="font-semibold">{t(`trust.generator.diff.${row.kind}`)}</span> {row.id} / {row.property}: {show(row.value)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
