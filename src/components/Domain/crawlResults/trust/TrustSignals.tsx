import { useTranslation } from 'react-i18next';
import type { TransparencyKind, TrustReport } from '@/services/eeatTrust';
import { TrustClaimEvidence } from './TrustClaimEvidence';

const KINDS: TransparencyKind[] = ['editorial', 'about', 'contact', 'registry'];

export const TrustSignals = ({ report, projectId }: { report: TrustReport; projectId?: string | null }) => {
  const { t } = useTranslation();
  const { citations, transparency } = report;
  return (
    <section aria-labelledby="trust-signals-title" className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 id="trust-signals-title" className="text-sm font-semibold text-slate-200">{t('trust.signals.title')}</h2>
      <p className="text-xs text-slate-300">{t('trust.signals.citations', { trusted: citations.pagesWithTrusted, pages: citations.pagesAnalyzed })}</p>
      <TrustClaimEvidence claims={citations.claimEvidence ?? []} unbacked={citations.unbackedHighStakesClaims} projectId={projectId} />
      {citations.deadLinks.length > 0 && (
        <details className="text-xs text-amber-200">
          <summary className="cursor-pointer">{t('trust.signals.dead', { count: citations.deadLinks.length })}</summary>
          <ul className="mt-1 space-y-0.5 text-slate-400">
            {citations.deadLinks.slice(0, 20).map((link) => <li key={`${link.page}|${link.target}`} className="break-all">{link.target}{link.status ? ` (${link.status})` : ''}</li>)}
          </ul>
        </details>
      )}
      {transparency.articles > 0 && <p className="text-xs text-slate-300">{t('trust.signals.dated', { dated: transparency.datedArticles, articles: transparency.articles })}</p>}
      <ul aria-label={t('trust.signals.pagesTitle')} className="grid gap-1 sm:grid-cols-2">
        {KINDS.map((kind) => {
          const url = transparency.found[kind];
          return (
            <li key={kind} className="flex items-center justify-between gap-2 rounded border border-slate-800 px-2 py-1 text-xs text-slate-300">
              <span>{t(`trust.signals.page.${kind}`)}</span>
              <span className={url ? 'text-emerald-300' : 'text-rose-300'}>{url ? `✓ ${t('trust.signals.found')}` : `✗ ${t('trust.signals.missing')}`}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
