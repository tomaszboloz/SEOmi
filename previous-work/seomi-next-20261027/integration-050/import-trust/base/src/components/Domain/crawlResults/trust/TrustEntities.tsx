import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { AuthorEntity, TrustReport } from '@/services/eeatTrust';
import { FOCUS_RING } from './trustHelpers';

export interface TrustEntitiesProps { report: TrustReport; onGenerate: (author: AuthorEntity) => void }

const MARK = (ok: boolean, yes: string, no: string) => <span className={ok ? 'text-emerald-300' : 'text-rose-300'}>{ok ? `✓ ${yes}` : `✗ ${no}`}</span>;

export const TrustEntities = ({ report, onGenerate }: TrustEntitiesProps) => {
  const { t } = useTranslation();
  const { organization: org } = report.schema;
  return (
    <section aria-labelledby="trust-entities-title" className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 id="trust-entities-title" className="flex items-center gap-1 text-sm font-semibold text-slate-200">
        {t('trust.entities.title')} <HelpTip id="trust.sameAs" />
      </h2>
      <p className="text-xs text-slate-300">
        {org.present
          ? t('trust.entities.orgPresent', { name: org.name ?? '-', id: org.hasId ? '✓' : '✗', sameAs: org.sameAs.length })
          : t('trust.entities.orgMissing')}
      </p>
      {report.authors.length === 0 ? <p className="text-xs text-slate-500">{t('trust.entities.none')}</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs text-slate-300">
            <thead className="text-slate-400">
              <tr>
                <th scope="col" className="py-1 pe-2 text-start">{t('trust.entities.colAuthor')}</th>
                <th scope="col" className="px-2 text-end">{t('trust.entities.colArticles')}</th>
                <th scope="col" className="px-2 text-start">{t('trust.entities.colSameAs')}</th>
                <th scope="col" className="px-2 text-end">{t('trust.entities.colAlignment')}</th>
                <th scope="col"><span className="sr-only">{t('trust.generator.open')}</span></th>
              </tr>
            </thead>
            <tbody>
              {report.authors.slice(0, 25).map((author) => (
                <tr key={author.key} className="border-t border-slate-800">
                  <td className="py-1 pe-2">
                    {author.name}
                    {author.generic && <span className="ms-2 rounded bg-rose-500/20 px-1 text-rose-200">{t('trust.entities.generic')}</span>}
                  </td>
                  <td className="px-2 text-end tabular-nums">{author.articleUrls.length}</td>
                  <td className="px-2">{MARK(author.sameAs.length > 0, String(author.sameAs.length), '0')}</td>
                  <td className="px-2 text-end tabular-nums">{author.alignmentPct === undefined ? '-' : `${author.alignmentPct}%`}</td>
                  <td className="text-end">
                    <button type="button" onClick={() => onGenerate(author)} className={`rounded border border-slate-600 px-2 py-0.5 text-emerald-300 hover:bg-slate-800 ${FOCUS_RING}`}>
                      {t('trust.generator.open')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
