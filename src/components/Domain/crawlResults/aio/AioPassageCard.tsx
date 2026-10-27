import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CopilotPatcherPanel, pageHasPatchContext, patchTargetForPassage } from '@/components/Results/copilotPatcher';
import { compareRewrite, passageRevision, rewritePassage, type AioChunk, type RewriteComparison } from '@/services/aioReadiness';
import { createBriefDeps } from '@/services/siteFocusBenchmark/adapter';
import { copyText } from '@/services/clipboard';
import { downloadBlob } from '@/services/download';
import type { CrawledPageSummary } from '@/types';
import { AioPassageEvidence } from './AioPassageEvidence';

type Passage = AioChunk & { url: string };
type State = { status: 'idle' | 'busy' | 'ok' | 'no-key' | 'empty' | 'cancelled' | 'error'; text?: string; message?: string };

const btn = 'rounded border border-slate-600 px-2 py-1 text-xs text-slate-100 hover:bg-slate-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400';

export const AioPassageCard = ({ passage, index, page, projectId, runId }: { passage: Passage; index: number; page?: CrawledPageSummary; projectId?: string | null; runId?: string | null }) => {
  const { t } = useTranslation();
  const [state, setState] = useState<State>({ status: 'idle' });
  const [review, setReview] = useState<RewriteComparison | null>(null);
  const [approved, setApproved] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const revision = useMemo(() => passageRevision(passage), [passage]);
  const contextKey = `${projectId ?? ''}|${runId ?? ''}|${revision}`;
  const contextRef = useRef(contextKey);
  contextRef.current = contextKey;
  const optimized = state.status === 'ok' ? state.text : undefined;
  const patchTarget = useMemo(() => patchTargetForPassage(page, passage), [page, passage]);
  const reviewPartial = review !== null && (review.before.availability !== 'complete' || review.after.availability !== 'complete');

  useEffect(() => () => controller.current?.abort(), [contextKey]);
  useEffect(() => { setState({ status: 'idle' }); setReview(null); setApproved(false); }, [contextKey]);

  const generate = async (): Promise<void> => {
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    const expected = contextKey;
    setState({ status: 'busy' });
    const outcome = await rewritePassage(createBriefDeps(), passage, { signal: active.signal });
    if (expected !== contextRef.current) return;
    if (active.signal.aborted) { setState({ status: 'cancelled' }); return; }
    setState(outcome.status === 'ok' ? outcome : outcome.status === 'error' ? { status: 'error', message: outcome.message } : { status: outcome.status });
    if (outcome.status === 'ok') setReview(compareRewrite(passage.text, outcome.text, passage.heading, {
      language: page?.semantic_language ?? page?.document_language,
      coreTerms: page?.focus_terms?.map((term) => term.term),
    }));
  };
  const copy = async (): Promise<void> => {
    if (optimized) await copyText(optimized);
  };
  const exportDraft = (): void => { if (optimized) downloadBlob(`seomi-aio-draft-${index + 1}.txt`, new Blob([optimized], { type: 'text/plain;charset=utf-8' })); };

  return (
    <li className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-300" data-testid="aio-passage">
      <p className="break-all font-medium text-slate-100">{passage.url}</p>
      <p className="text-slate-400">
        {passage.heading || t('aio.passage.noHeading')} · {t('aio.passage.chunk', { n: passage.windowIndex + 1, tokens: passage.tokens, score: passage.score })}
      </p>
      <ul className="flex flex-wrap gap-1" aria-label={t('aio.passage.title')}>
        {passage.issues.map((issue) => <li key={issue} className="rounded bg-rose-500/10 px-2 py-0.5 text-rose-200">{t(`aio.issue.${issue}`)}</li>)}
      </ul>
      <AioPassageEvidence passage={passage} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn} disabled={state.status === 'busy'} onClick={() => void generate()} aria-label={`${t('aio.passage.generate')} ${index + 1}`}>
          {state.status === 'busy' ? t('aio.passage.generating') : t('aio.passage.generate')}
        </button>
        {state.status === 'busy' && <button type="button" className={btn} onClick={() => controller.current?.abort()}>{t('aio.passage.cancel')}</button>}
        {state.status === 'no-key' && <p role="status" className="text-amber-200">{t('aio.passage.noKey')}</p>}
        {state.status === 'empty' && <p role="status" className="text-amber-200">{t('aio.passage.empty')}</p>}
        {state.status === 'cancelled' && <p role="status" className="text-slate-400">{t('aio.passage.cancelled')}</p>}
        {state.status === 'error' && <p role="alert" className="text-rose-300">{t('aio.passage.error', { message: state.message })}</p>}
      </div>
      {optimized && (
        <div className="space-y-1 rounded border border-emerald-500/30 bg-emerald-500/5 p-2" data-testid="aio-optimized">
          <p className="font-semibold text-emerald-200">{t('aio.passage.optimized')}</p>
          <p className="whitespace-pre-line text-slate-100">{optimized}</p>
          {review && <div className="grid gap-1 text-[11px] text-slate-400 sm:grid-cols-3" data-testid="aio-review-profile" data-profile-id={review.before.profile.id} data-config-hash={review.before.profile.configHash}>
            <span>{t('aio.passage.scoreChange', { delta: review.delta ?? '—' })}</span><span>{t('aio.passage.beforeAfter', { before: review.before.score ?? '—', after: review.after.score ?? '—' })}</span><span>{t('aio.passage.facts', { before: review.before.factCount ?? '—', after: review.after.factCount ?? '—' })}</span>
            <span className="sm:col-span-3" data-testid="aio-review-profile-meta">{review.before.profile.algorithmVersion} · {review.before.profile.configHash}</span>
          </div>}
          {reviewPartial && <p role="status" data-testid="aio-review-partial" className="text-amber-200">{t('aio.passage.partialProfile')}</p>}
          {review && !review.preservation.ok && <p role="alert" className="text-amber-200">{t('aio.passage.preservationWarning', { missing: Object.values(review.preservation.missing).flat().join(', ') })}</p>}
          <p className="text-amber-200/80">{t('aio.passage.unverified')}</p>
          <div className="flex flex-wrap gap-2"><button type="button" className={btn} onClick={() => void copy()}>{t('aio.passage.copy')}</button><button type="button" className={btn} onClick={exportDraft}>{t('aio.passage.export')}</button><button type="button" className={btn} aria-pressed={approved} onClick={() => setApproved(true)}>{approved ? t('aio.passage.approved') : t('aio.passage.approve')}</button></div>
          {approved && review?.diff.changed && <details className="rounded border border-slate-700 p-2"><summary className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">{t('aio.passage.diff')}</summary><div className="mt-1 space-y-1"><p className="text-rose-200">{review.diff.removedLines.join('\n')}</p><p className="text-emerald-200">{review.diff.addedLines.join('\n')}</p></div></details>}
        </div>
      )}
      {pageHasPatchContext(page) ? <CopilotPatcherPanel target={patchTarget} projectId={projectId} index={index} /> : <p role="status" className="text-[11px] text-slate-500">{t('copilotPatcherUi.contextUnavailable')}</p>}
    </li>
  );
};
