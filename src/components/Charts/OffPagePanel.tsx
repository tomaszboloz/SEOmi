import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { CoCitationReport } from '@/services/offPage/cocitation';
import type { TbvaReport } from '@/services/offPage/tbva';

interface Props { tbva: TbvaReport; coCitation: CoCitationReport }

/** Topical backlink value and brand co-citations. Empty states when data is missing. */
export const OffPagePanel = ({ tbva, coCitation }: Props) => {
  const { t } = useTranslation();
  return <section className="space-y-2 text-xs text-slate-200" aria-label={t('offPageUi.title')}>
    <h4 className="font-semibold">{t('offPageUi.title')} <HelpTip id="offPage.tbva" /></h4>
    {tbva.tbva === null
      ? <p role="status" className="text-slate-400">{t('offPageUi.empty')}</p>
      : <p>{t('offPageUi.tbva', { value: tbva.tbva, count: tbva.counted, coverage: Math.round((tbva.coverage ?? 0) * 100) })}</p>}
    {tbva.status === 'partial' && <p className="text-amber-300">{t('offPageUi.partial', { count: tbva.unscored })}</p>}
    {tbva.nofollow > 0 && <p className="text-slate-400">{t('offPageUi.nofollow', { count: tbva.nofollow })}</p>}
    {coCitation.note === 'no-source-text'
      ? <p className="text-slate-400">{t('offPageUi.noText')}</p>
      : <p>{t('offPageUi.coCitation', { linked: coCitation.linked.length, unlinked: coCitation.unlinked.length })}</p>}
    <p className="text-slate-500">{t('offPageUi.note')}</p>
  </section>;
};
