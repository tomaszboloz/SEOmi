import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { comparableRewrites, readRewriteHistory, type AioChunk, type RewriteComparison } from '@/services/aioReadiness';
import { acceptRewriteIntoBrief } from '@/services/aioReadiness/acceptRewrite';
import { readTopicalMap, writeTopicalMap } from '@/services/topicalDocument/storage';

const btn = 'rounded border border-slate-600 px-2 py-1 text-xs text-slate-100 hover:bg-slate-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400';

interface Props { passage: AioChunk & { url: string }; title: string; optimized: string; review: RewriteComparison | null; revision: string; projectId?: string | null }
type Status = 'idle' | 'accepted' | 'failed';

/** Manual accept: the only path that writes a rewrite into a brief. Never runs automatically. */
export const AioPassageAccept = ({ passage, title, optimized, review, revision, projectId }: Props) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>('idle');
  const [version, setVersion] = useState('');
  const [history, setHistory] = useState(() => readRewriteHistory(projectId));
  useEffect(() => { setStatus('idle'); setHistory(readRewriteHistory(projectId)); }, [projectId, revision, optimized]);
  const configHash = review?.before.profile.configHash ?? '';
  const { comparable, other } = useMemo(() => comparableRewrites(history, revision, configHash), [history, revision, configHash]);
  const last = comparable[comparable.length - 1];

  const accept = (): void => {
    if (!projectId || !review) return;
    try {
      const result = acceptRewriteIntoBrief(readTopicalMap(projectId), { url: passage.url, title, heading: passage.heading, revision, before: passage.text, after: optimized });
      if (!result.nodeId) { setStatus('failed'); return; }
      writeTopicalMap(projectId, result.document);
      setVersion(result.versionNote);
      setStatus('accepted');
    } catch { setStatus('failed'); }
  };

  return <div className="space-y-1">
    <button type="button" className={btn} aria-pressed={status === 'accepted'} disabled={!projectId || !review} onClick={accept}>{status === 'accepted' ? t('aio.passage.approved') : t('aio.passage.approve')}</button>
    {status === 'accepted' && <p role="status" className="text-emerald-200" data-testid="aio-accepted">{t('aio.passage.brief.accepted', { version })}</p>}
    {status === 'failed' && <p role="alert" className="text-rose-300">{t('aio.passage.brief.failed')}</p>}
    {!projectId && <p role="status" className="text-slate-400">{t('aio.passage.brief.noProject')}</p>}
    {last && <p className="text-[11px] text-slate-400" data-testid="aio-rewrite-history">{t('aio.passage.history.comparable', { count: comparable.length, delta: last.delta ?? '—' })}{other > 0 && ` ${t('aio.passage.history.other', { count: other })}`}</p>}
  </div>;
};
