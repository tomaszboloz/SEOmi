import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { ParityReport } from '@/services/hreflangParity/parity';

/** Per-language topic parity. Inconclusive reports list what is missing instead of a score. */
export const HreflangParityPanel = ({ report }: { report: ParityReport }) => {
  const { t } = useTranslation();
  return <section className="space-y-2 text-xs text-slate-200" aria-label={t('parityUi.title')}>
    <h4 className="font-semibold">{t('parityUi.title')} <HelpTip id="parity.hreflang" /></h4>
    {report.status === 'inconclusive'
      ? <><p role="status" className="text-slate-400">{t('parityUi.inconclusive')}</p>
        <ul className="list-disc pl-4">{report.gaps.map((g) => <li key={g}>{t(`parityUi.gap.${g}`)}</li>)}</ul></>
      : <table className="w-full text-left">
        <thead><tr><th>{t('parityUi.language')}</th><th>{t('parityUi.topic')}</th><th>{t('parityUi.status')}</th></tr></thead>
        <tbody>{report.rows.map((r) => <tr key={`${r.language}-${r.topic}`}><td>{r.language}</td><td>{r.topic}</td><td>{t(`parityUi.statuses.${r.status}`)}</td></tr>)}</tbody>
      </table>}
    <p className="text-slate-500">{t('parityUi.note')}</p>
  </section>;
};
