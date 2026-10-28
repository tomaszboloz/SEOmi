import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { AuthorEntity, TrustReport } from '@/services/eeatTrust';
import { FOCUS_RING } from './trustHelpers';

export interface TrustEntitiesProps { report: TrustReport; onGenerate: (author: AuthorEntity) => void; onVerify?: (author: AuthorEntity) => void }

const MARK = (ok: boolean, yes: string, no: string) => <span className={ok ? 'text-emerald-300' : 'text-rose-300'}>{ok ? `✓ ${yes}` : `✗ ${no}`}</span>;

export const TrustEntities = ({ report, onGenerate, onVerify }: TrustEntitiesProps) => {
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
                <Fragment key={author.key}>
                <tr className="border-t border-slate-800">
                  <td className="py-1 pe-2">
                    {author.name}
                    {author.generic && <span className="ms-2 rounded bg-rose-500/20 px-1 text-rose-200">{t('trust.entities.generic')}</span>}
                  </td>
                  <td className="px-2 text-end tabular-nums">{author.articleUrls.length}</td>
                  <td className="px-2">{MARK(author.sameAs.length > 0, String(author.sameAs.length), '0')}</td>
                  <td className="px-2 text-end tabular-nums">{author.alignmentPct === undefined ? '-' : `${author.alignmentPct}%`}</td>
                  <td className="text-end">
                    {onVerify && <button type="button" onClick={() => onVerify(author)} className={`me-1 rounded border border-slate-600 px-2 py-0.5 text-sky-300 hover:bg-slate-800 ${FOCUS_RING}`}>{t('trust.entities.verifyProfiles')}</button>}
                    <button type="button" onClick={() => onGenerate(author)} className={`rounded border border-slate-600 px-2 py-0.5 text-emerald-300 hover:bg-slate-800 ${FOCUS_RING}`}>
                      {t('trust.generator.open')}
                    </button>
                  </td>
                </tr>
                <tr key={`${author.key}-evidence`} className="border-t border-slate-900 text-[10px] text-slate-500">
                  <td colSpan={5} className="py-1">
                    <details>
                      <summary className="cursor-pointer">{t('trust.entities.identityEvidence')} · {author.reconciliation?.status ?? 'unavailable'} · {Math.round((author.reconciliation?.declarationRecall ?? 0) * 100)}%</summary>
                      <ul className="mt-1 space-y-0.5 ps-4">
                        {author.profiles.slice(0, 8).map((profile) => <li key={`${profile.kind}|${profile.url}`} className="break-all">{profile.kind}: {profile.status} · {profile.url}</li>)}
                        {!author.profiles.length && <li>{t('trust.entities.unavailableNote')}</li>}
                      </ul>
                    </details>
                  </td>
                </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(report.roleEntities ?? []).length > 0 && (
        <ul className="space-y-0.5 text-xs text-slate-400">
          {(report.roleEntities ?? []).slice(0, 12).map((entity) => (
            <li key={entity.key} className="break-all">
              {t('trust.entities.roleEvidence', {
                role: t(entity.role === 'reviewer' ? 'trust.entities.roleReviewer' : 'trust.entities.rolePublisher'),
                name: entity.name, status: entity.reconciliation.status,
                recall: Math.round(entity.reconciliation.declarationRecall * 100),
              })}
            </li>
          ))}
        </ul>
      )}
      {report.roleRecall !== undefined && (
        <p className="text-xs text-slate-500">{t('trust.entities.roleRecall', { pct: Math.round(report.roleRecall * 100) })}</p>
      )}
    </section>
  );
};
