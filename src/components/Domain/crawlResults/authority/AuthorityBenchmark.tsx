import { useTranslation } from 'react-i18next';
import type { TopicalBenchmark } from '@/services/topicalAuthorityReference';
import { pillarName, pct, toneFor } from './authorityText';

/** Topical Gap Matrix: your pillars against the top-ranking competitors, scored with the same engine. */
export const AuthorityBenchmark = ({ benchmark }: { benchmark: TopicalBenchmark | null }) => {
  const { t } = useTranslation();
  const domains = benchmark ? benchmark.rows.filter((row) => !row.isOwn).map((row) => row.domain) : [];
  return (
    <section aria-labelledby="authority-bench-title" className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 id="authority-bench-title" className="text-sm font-semibold text-slate-200">{t('authority.benchmark.title')}</h2>
      {!benchmark ? <p className="text-xs text-slate-500">{t('authority.benchmark.empty')}</p> : (
        <>
          <p className="text-xs text-slate-400">{t('authority.benchmark.provenance', { source: benchmark.source || '—', date: benchmark.builtAt.slice(0, 10) })}</p>
          {benchmark.sample && <p className="text-xs text-slate-400" role="status">{t('authority.benchmark.sample', { scored: benchmark.sample.scored, attempted: benchmark.sample.attempted })}
            {benchmark.sample.failed.length > 0 && ` ${t('authority.benchmark.failed', { domains: benchmark.sample.failed.join(', ') })}`}</p>}
          {benchmark.serpEvidence && !benchmark.serpEvidence.fullScoreEligible && <p role="status" data-testid="authority-partial-serp" className="text-xs text-amber-300">
            {t('focusBenchmark.partialSerp', { min: benchmark.serpEvidence.minK, max: benchmark.serpEvidence.maxK, providers: benchmark.serpEvidence.providers.join(', ') })}</p>}
          <table className="w-full text-start text-xs text-slate-200" aria-label={t('authority.benchmark.title')}>
            <thead><tr className="text-slate-400"><th className="text-start">{t('authority.benchmark.domain')}</th><th className="text-start">{t('authority.matrix.axisX')}</th><th className="text-start">{t('authority.matrix.axisY')}</th></tr></thead>
            <tbody>{benchmark.rows.map((row) => (
              <tr key={row.domain} data-own={row.isOwn}><td>{row.domain}{row.isOwn ? ` (${t('authority.matrix.you')})` : ''}</td><td>{row.sfs}</td><td className={toneFor(row.tas)}>{row.tas ?? '—'}</td></tr>
            ))}</tbody>
          </table>
          <table className="w-full text-start text-xs text-slate-200" aria-label={t('authority.benchmark.pillars')}>
            <thead><tr className="text-slate-400"><th className="text-start">{t('authority.benchmark.pillar')}</th><th className="text-start">{t('authority.matrix.you')}</th>{domains.map((domain) => <th key={domain} className="text-start">{domain}</th>)}</tr></thead>
            <tbody>{benchmark.pillars.map((pillar) => (
              <tr key={pillar.id}><td>{pillarName(t, pillar.id, pillar.label)}</td><td className={toneFor(pillar.own)}>{pct(pillar.own)}%</td>{domains.map((domain) => <td key={domain}>{pct(pillar.competitors[domain] ?? 0)}%</td>)}</tr>
            ))}</tbody>
          </table>
          <ul className="list-disc space-y-1 ps-5 text-xs text-slate-300">{benchmark.insights.map((insight) => <li key={insight.code}>{t(`authority.benchmark.insight.${insight.code}`, insight.params)}</li>)}</ul>
        </>
      )}
    </section>
  );
};
