import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CrawlRunRecord } from '@/types';
import type { PrePublishReport } from '@/services/prePublish/check';
import { normalizeDraftUrl, prePublishContext } from '@/services/prePublish/context';
import { checkPrePublish } from '@/services/prePublish/embeddingCheck';
import { loadEmbeddingSession } from '@/components/Keywords/embeddingClustering/useEmbeddingClustering';

type Status = 'idle' | 'running' | 'done' | 'unreachable' | 'cancelled' | 'stale';
interface State { status: Status; report: PrePublishReport | null }

export const usePrePublish = (projectId: string | null, runs: CrawlRunRecord[]) => {
  const context = useMemo(() => prePublishContext(projectId, runs), [projectId, runs]);
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [state, setState] = useState<State>({ status: 'idle', report: null });
  const revision = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const owner = useRef<typeof context | null>(null);
  useLayoutEffect(() => {
    owner.current = context;
    setState((previous) => ({ status: previous.status === 'idle' ? 'idle' : 'stale', report: null }));
    return () => {
      owner.current = null;
      revision.current += 1;
      controller.current?.abort();
    };
  }, [context]);
  const invalidate = (cancelled = false) => {
    revision.current += 1;
    controller.current?.abort();
    setState((previous) => ({ status: cancelled ? 'cancelled' : previous.status === 'idle' ? 'idle' : 'stale', report: null }));
  };
  const changeText = (value: string) => { invalidate(); setText(value); };
  const changeUrl = (value: string) => { invalidate(); setUrl(value); };
  const invalidUrl = normalizeDraftUrl(url) === null;
  const run = async () => {
    if (owner.current !== context || !context.run || !text.trim() || invalidUrl) return;
    controller.current?.abort();
    const request = ++revision.current;
    const abort = new AbortController();
    controller.current = abort;
    setState({ status: 'running', report: null });
    try {
      const report = await checkPrePublish(text, url, context, loadEmbeddingSession(projectId).settings, abort.signal);
      if (request === revision.current) setState({ status: 'done', report });
    } catch {
      if (request === revision.current) setState({ status: 'unreachable', report: null });
    }
  };
  return { ...state, text, url, invalidUrl, context, changeText, changeUrl, run, cancel: () => invalidate(true) };
};
