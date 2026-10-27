import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { HelpId } from '@/components/Help/helpTypes';
import type { IgosParts as Parts } from '@/services/informationGain';

const Tile = ({ label, value, help, note }: { label: string; value: number | null; help: HelpId; note?: string }) => (
  <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
    <dt className="flex items-center gap-1 text-xs text-slate-400">{label} <HelpTip id={help} /></dt>
    <dd className="text-lg font-semibold tabular-nums text-slate-100">{value === null ? '—' : `${value}%`}</dd>
    {note && <p className="text-[11px] text-slate-500">{note}</p>}
  </div>
);

export interface IgosPartsProps { parts: Parts; fhemUnavailablePages: number }

/** The four weighted components behind the score. */
export const IgosParts = ({ parts, fhemUnavailablePages }: IgosPartsProps) => {
  const { t } = useTranslation();
  return (
    <section aria-label={t('infoGain.parts.title')}>
      <dl className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile label={t('infoGain.parts.nefr')} value={parts.nefr} help="infoGain.novelEntities" />
        <Tile label={t('infoGain.parts.edsi')} value={parts.edsi} help="infoGain.empirical" />
        <Tile label={t('infoGain.parts.fhem')} value={parts.fhem} help="infoGain.firstHand" note={fhemUnavailablePages ? t('infoGain.parts.fhemNote', { count: fhemUnavailablePages }) : undefined} />
        <Tile label={t('infoGain.parts.sdd')} value={parts.sdd} help="infoGain.divergence" />
      </dl>
    </section>
  );
};
