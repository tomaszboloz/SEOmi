import { useTranslation } from 'react-i18next';
import type { EntityGap, EntityLink, LanguageTopic } from '@/services/entityIds';

export interface EntityParityPanelProps {
  links: EntityLink[];
  gaps: EntityGap[];
  pending: number;
  running: boolean;
  onMatch: () => void;
  /** Absent without a project: corrections cannot be saved. */
  onCorrect?: (topic: LanguageTopic, input: string) => void;
}

const wikidataUrl = (qid: string): string => `https://www.wikidata.org/wiki/${qid}`;

/** Cross-language entity coverage via Wikidata IDs: alerts list missing language versions, nothing is changed automatically. */
export const EntityParityPanel = ({ links, gaps, pending, running, onMatch, onCorrect }: EntityParityPanelProps) => {
  const { t } = useTranslation();
  const failed = links.filter((link) => link.confidence === 'error').length;
  return <section className="space-y-2 text-xs text-slate-200" aria-label={t('entityParity.title')}>
    <h4 className="font-semibold">{t('entityParity.title')}</h4>
    <p className="text-slate-400">{t('entityParity.intro')}</p>
    <button type="button" disabled={running || pending === 0} onClick={onMatch} className="rounded border border-slate-600 px-2 py-1 disabled:opacity-50">
      {running ? t('entityParity.running') : t('entityParity.match', { count: pending })}
    </button>
    {failed > 0 && <p role="alert" className="text-amber-300">{t('entityParity.failed', { count: failed })}</p>}
    {links.some((link) => link.qid) && (gaps.length === 0
      ? <p role="status" className="text-emerald-300">{t('entityParity.noGaps')}</p>
      : <ul className="list-disc space-y-1 ps-5" aria-label={t('entityParity.gapsTitle')}>
        {gaps.map((gap) => <li key={gap.qid} className="break-words">
          {t('entityParity.gap', { label: gap.label, present: gap.presentIn.join(', '), missing: gap.missingIn.join(', ') })}{' '}
          <span className="text-slate-500">({gap.qid})</span>
          {!gap.reviewed && <span className="ms-1 text-amber-300">{t('entityParity.needsReview')}</span>}
        </li>)}
      </ul>)}
    {onCorrect && links.length > 0 && <details>
      <summary className="cursor-pointer text-slate-300">{t('entityParity.correctTitle')}</summary>
      <table className="w-full text-start">
        <thead><tr><th>{t('parityUi.language')}</th><th>{t('parityUi.topic')}</th><th>{t('entityParity.entity')}</th></tr></thead>
        <tbody>{links.map((link) => <tr key={`${link.language}|${link.topic}`}>
          <td>{link.language}</td><td className="break-words">{link.label}</td>
          <td>
            {link.qid ? <a className="underline" href={wikidataUrl(link.qid)} target="_blank" rel="noopener noreferrer">{link.qid}</a> : '—'}{' '}
            <span className="text-slate-500">{t(`entityParity.confidence.${link.confidence}`)}</span>
            <input className="ms-1 w-24 border border-slate-600 bg-transparent px-1" defaultValue={link.confidence === 'manual' ? link.qid ?? 'none' : ''}
              aria-label={t('entityParity.correctLabel', { topic: link.label, language: link.language })} placeholder="Q123 / none"
              onBlur={(event) => onCorrect(link, event.currentTarget.value)} />
          </td>
        </tr>)}</tbody>
      </table>
    </details>}
  </section>;
};
