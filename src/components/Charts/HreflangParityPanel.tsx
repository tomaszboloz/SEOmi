import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import { summarize, type ParityReport, type ParityRow } from '@/services/hreflangParity/parity';
import { parityTopicKey } from '@/services/hreflangParity/exceptions';

export interface ParityExceptionHandlers {
  onToggle: (language: string, topicKey: string) => void;
  onReason: (language: string, topicKey: string, reason: string) => void;
}

const ExceptionCell = ({ row, handlers }: { row: ParityRow; handlers: ParityExceptionHandlers }) => {
  const { t } = useTranslation();
  const key = parityTopicKey(row.topic, row.label);
  const name = row.label ?? row.topic;
  const local = row.status === 'intentionally-local';
  return <td className="space-y-1">
    <button type="button" className="underline" onClick={() => handlers.onToggle(row.language, key)}
      aria-label={t(local ? 'parityUi.exception.removeLabel' : 'parityUi.exception.addLabel', { topic: name, language: row.language })}>
      {t(local ? 'parityUi.exception.remove' : 'parityUi.exception.add')}
    </button>
    {local && <input className="block w-full bg-transparent border border-slate-600 px-1" defaultValue={row.reason ?? ''} maxLength={300}
      aria-label={t('parityUi.exception.reasonLabel', { topic: name, language: row.language })} placeholder={t('parityUi.exception.reasonPlaceholder')}
      onBlur={(event) => handlers.onReason(row.language, key, event.currentTarget.value)} />}
  </td>;
};

/** Per-language topic parity. Inconclusive reports list what is missing instead of a score. */
export const HreflangParityPanel = ({ report, exceptions }: { report: ParityReport; exceptions?: ParityExceptionHandlers }) => {
  const { t } = useTranslation();
  const counts = summarize(report);
  return <section className="space-y-2 text-xs text-slate-200" aria-label={t('parityUi.title')}>
    <h4 className="font-semibold">{t('parityUi.title')} <HelpTip id="parity.hreflang" /></h4>
    {report.scope && <p className="text-slate-400">{t(`parityUi.scope.${report.scope}`, { clusters: report.clusters ?? 0, issues: report.graphIssues ?? 0 })}</p>}
    {report.status === 'inconclusive'
      ? <><p role="status" className="text-slate-400">{t('parityUi.inconclusive')}</p>
        <ul className="list-disc pl-4">{report.gaps.map((g) => <li key={g}>{t(`parityUi.gap.${g}`)}</li>)}</ul></>
      : <>
        <p role="status">{t('parityUi.summary', { covered: counts.covered, shallow: counts.shallow, missing: counts.missing, local: counts['intentionally-local'] })}</p>
        <table className="w-full text-left">
        <thead><tr><th>{t('parityUi.language')}</th><th>{t('parityUi.topic')}</th><th>{t('parityUi.status')}</th>{exceptions && <th>{t('parityUi.exception.column')}</th>}</tr></thead>
        <tbody>{report.rows.map((r) => <tr key={`${r.language}-${r.topic}`}><td>{r.language}</td><td>{r.label ?? r.topic}</td>
          <td>{t(`parityUi.statuses.${r.status}`)}{r.reason ? ` — ${r.reason}` : ''}</td>
          {exceptions && <ExceptionCell row={r} handlers={exceptions} />}</tr>)}</tbody>
      </table></>}
    <p className="text-slate-500">{t('parityUi.note')}</p>
  </section>;
};
