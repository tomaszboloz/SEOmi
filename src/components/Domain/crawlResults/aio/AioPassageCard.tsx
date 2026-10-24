import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CopilotPatcherPanel, pageHasPatchContext, patchTargetForPassage } from '@/components/Results/copilotPatcher';
import { rewritePassage, type AioChunk } from '@/services/aioReadiness';
import { createBriefDeps } from '@/services/siteFocusBenchmark/adapter';
import type { CrawledPageSummary } from '@/types';

type Passage = AioChunk & { url: string };
type State = { status: 'idle' | 'busy' | 'copied' } | { status: 'ok'; text: string } | { status: 'error'; message: string } | { status: 'no-key' | 'empty' };

const btn = 'rounded border border-slate-600 px-2 py-1 text-xs text-slate-100 hover:bg-slate-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400';

export const AioPassageCard = ({ passage, index, page, projectId }: { passage: Passage; index: number; page?: CrawledPageSummary; projectId?: string | null }) => {
  const { t } = useTranslation();
  const [state, setState] = useState<State>({ status: 'idle' });
  const optimized = state.status === 'ok' ? state.text : undefined;
  const patchTarget = useMemo(() => patchTargetForPassage(page, passage), [page, passage]);

  const generate = async (): Promise<void> => {
    setState({ status: 'busy' });
    const outcome = await rewritePassage(createBriefDeps(), passage);
    setState(outcome.status === 'ok' ? outcome : outcome.status === 'error' ? { status: 'error', message: outcome.message } : { status: outcome.status });
  };
  const copy = async (): Promise<void> => {
    if (optimized) await navigator.clipboard.writeText(optimized).catch(() => undefined);
  };

  return (
    <li className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-300" data-testid="aio-passage">
      <p className="break-all font-medium text-slate-100">{passage.url}</p>
      <p className="text-slate-400">
        {passage.heading || t('aio.passage.noHeading')} · {t('aio.passage.chunk', { n: passage.windowIndex + 1, tokens: passage.tokens, score: passage.score })}
      </p>
      <ul className="flex flex-wrap gap-1" aria-label={t('aio.passage.title')}>
        {passage.issues.map((issue) => <li key={issue} className="rounded bg-rose-500/10 px-2 py-0.5 text-rose-200">{t(`aio.issue.${issue}`)}</li>)}
      </ul>
      <p className="whitespace-pre-line rounded bg-slate-900 p-2 text-slate-200"><span className="sr-only">{t('aio.passage.current')}: </span>{passage.text}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn} disabled={state.status === 'busy'} onClick={() => void generate()} aria-label={`${t('aio.passage.generate')} ${index + 1}`}>
          {state.status === 'busy' ? t('aio.passage.generating') : t('aio.passage.generate')}
        </button>
        {state.status === 'no-key' && <p role="status" className="text-amber-200">{t('aio.passage.noKey')}</p>}
        {state.status === 'empty' && <p role="status" className="text-amber-200">{t('aio.passage.empty')}</p>}
        {state.status === 'error' && <p role="alert" className="text-rose-300">{t('aio.passage.error', { message: state.message })}</p>}
      </div>
      {optimized && (
        <div className="space-y-1 rounded border border-emerald-500/30 bg-emerald-500/5 p-2" data-testid="aio-optimized">
          <p className="font-semibold text-emerald-200">{t('aio.passage.optimized')}</p>
          <p className="whitespace-pre-line text-slate-100">{optimized}</p>
          <button type="button" className={btn} onClick={() => void copy()}>{t('aio.passage.copy')}</button>
        </div>
      )}
      {pageHasPatchContext(page) ? <CopilotPatcherPanel target={patchTarget} projectId={projectId} index={index} /> : <p role="status" className="text-[11px] text-slate-500">{t('copilotPatcherUi.contextUnavailable')}</p>}
    </li>
  );
};
