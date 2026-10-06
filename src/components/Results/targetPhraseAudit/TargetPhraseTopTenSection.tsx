import React from 'react';
import { Loader2, SearchCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SerpSource } from '@/services/serpImport';
import type { ContentGapTopic, TopTenContentGapReport } from '@/services/targetPhraseAudit';
import type { TargetPhraseAuditSession } from './useTargetPhraseAuditSession';
import { TargetPhraseTopTenRow } from './TargetPhraseTopTenRow';

interface TargetPhraseTopTenSectionProps {
  phrase: string;
  source: SerpSource | null;
  report: TopTenContentGapReport | null;
  unavailableReason: TargetPhraseAuditSession['unavailableReason'];
  canAudit: boolean;
  isLoading: boolean;
  error: string | null;
  onAudit: () => void;
}

const reasonKey = (reason: TargetPhraseAuditSession['unavailableReason']): string => reason ? `targetPhraseAuditUi.unavailable.${reason}` : '';

const TopicCard: React.FC<{ topic: ContentGapTopic }> = ({ topic }) => {
  const { t } = useTranslation();
  const statusClass = topic.status === 'gap' ? 'border-amber-500/25 bg-amber-500/5' : topic.status === 'covered' ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-slate-800 bg-slate-950/30';
  return (
    <article className={`rounded-xl border p-3 ${statusClass}`}>
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold text-slate-100">{topic.term}</h4>
        <span className="text-[11px] font-semibold text-slate-400">{t(`targetPhraseAuditUi.topicStatus.${topic.status}`)}</span>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">{t('targetPhraseAuditUi.topicShare', { observed: topic.observedPages, total: topic.availablePages, share: Math.round(topic.share * 100) })}</p>
      <p className="mt-1 text-[11px] text-slate-400">{topic.targetOccurrences === null ? t('targetPhraseAuditUi.targetOccurrencesUnknown') : t('targetPhraseAuditUi.targetOccurrences', { count: topic.targetOccurrences })}</p>
      {topic.evidence[0] && <p className="mt-2 line-clamp-3 text-[11px] leading-4 text-slate-500">{topic.evidence[0].excerpt}</p>}
    </article>
  );
};

export const TargetPhraseTopTenSection: React.FC<TargetPhraseTopTenSectionProps> = ({ phrase, source, report, unavailableReason, canAudit, isLoading, error, onAudit }) => {
  const { t } = useTranslation();
  const unavailableKey = reasonKey(unavailableReason);
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">{t('targetPhraseAuditUi.topTenTitle')}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">{t('targetPhraseAuditUi.topTenDescription')}</p>
        </div>
        <button type="button" onClick={onAudit} disabled={!canAudit || isLoading} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-45">
          {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <SearchCheck className="h-3.5 w-3.5" aria-hidden="true" />}
          {t(isLoading ? 'targetPhraseAuditUi.auditRunning' : 'targetPhraseAuditUi.auditTopTen')}
        </button>
      </div>
      {source && (
        <dl className="mt-4 grid gap-2 rounded-xl border border-slate-800 bg-slate-950/35 p-3 text-[11px] text-slate-400 sm:grid-cols-2">
          <div><dt className="inline text-slate-500">{t('targetPhraseAuditUi.sourceProvider')}: </dt><dd className="inline text-slate-200">{source.provider || t('targetPhraseAuditUi.unknown')}</dd></div>
          <div><dt className="inline text-slate-500">{t('targetPhraseAuditUi.sourceAvailability')}: </dt><dd className="inline text-slate-200">{t(`targetPhraseAuditUi.sourceStatus.${source.availability}`)}</dd></div>
          <div><dt className="inline text-slate-500">{t('targetPhraseAuditUi.sourceContext')}: </dt><dd className="inline text-slate-300">{source.countryCode || t('targetPhraseAuditUi.unknown')} · {source.locationCode ?? t('targetPhraseAuditUi.unknown')} · {source.languageCode || t('targetPhraseAuditUi.unknown')}</dd></div>
          <div><dt className="inline text-slate-500">{t('targetPhraseAuditUi.sourceCaptured')}: </dt><dd className="inline text-slate-300">{source.capturedAt || t('targetPhraseAuditUi.unknown')}</dd></div>
          <div><dt className="inline text-slate-500">{t('targetPhraseAuditUi.sourceRetrieved')}: </dt><dd className="inline text-slate-300">{source.retrievedAt || t('targetPhraseAuditUi.unknown')}</dd></div>
          {source.reason && <div className="sm:col-span-2"><dt className="inline text-slate-500">{t('targetPhraseAuditUi.sourceReason')}: </dt><dd className="inline text-amber-300">{source.reason}</dd></div>}
        </dl>
      )}
      {unavailableReason && <p className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">{t(unavailableKey)}</p>}
      {error && <p role="alert" className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-300">{error}</p>}
      {report && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span>{t('targetPhraseAuditUi.reportStatus')}: {t(`targetPhraseAuditUi.reportStatuses.${report.status}`)}</span>
            <span>·</span><span>{t('targetPhraseAuditUi.availablePages', { count: report.availablePages })}</span>
          </div>
          {report.rows.length ? <ul className="mt-2 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/20"><li className="sr-only">{phrase}</li>{report.rows.map((row) => <TargetPhraseTopTenRow key={`${row.rank}-${row.url}`} row={row} />)}</ul> : <p className="mt-3 text-xs text-slate-500">{t('targetPhraseAuditUi.noRows')}</p>}
          <div className="mt-5">
            <h4 className="text-xs font-semibold text-slate-200">{t('targetPhraseAuditUi.topicsTitle')}</h4>
            {report.topics.length ? <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{report.topics.slice(0, 12).map((topic) => <TopicCard key={topic.term} topic={topic} />)}</div> : <p className="mt-2 text-xs text-slate-500">{t('targetPhraseAuditUi.noTopics')}</p>}
          </div>
        </>
      )}
    </section>
  );
};
