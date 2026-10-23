import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { BusConflict, QuarantineEntry } from '@/services/recommendationBus';

interface Props {
  quarantine: QuarantineEntry[];
  conflicts?: BusConflict[];
  droppedCount?: number;
}

/** Single conflict list: URLs removed or redirected are excluded from every link target. */
export const QuarantineConflicts = ({ quarantine, conflicts = [], droppedCount = 0 }: Props) => {
  const { t } = useTranslation();
  if (!quarantine.length && !conflicts.length) return null;
  return <section aria-label={t('executionCard.bus.aria')} className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3 text-[10px] leading-4 text-amber-100">
    <h5 className="font-semibold">{t('executionCard.bus.title')} <HelpTip id="executionCard.bus" /></h5>
    <p className="mt-1 text-amber-200/80">{t('executionCard.bus.summary', { count: quarantine.length, dropped: droppedCount })}</p>
    <ul className="mt-2 space-y-1">
      {quarantine.map((entry) => <li key={entry.url} className="truncate font-mono" title={entry.url}>
        {t(`executionCard.bus.reason.${entry.reason}`)}: {entry.url}{entry.target ? ` → ${entry.target}` : ''}
      </li>)}
      {conflicts.map((item) => <li key={`${item.kind}-${item.url}`} className="truncate font-mono text-rose-200" title={item.url}>
        {t(`executionCard.bus.conflict.${item.kind}`)}: {item.url}
      </li>)}
    </ul>
  </section>;
};
