import { useEffect, useMemo, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import type { CrawledPageSummary } from '@/types';
import {
  DEFAULT_MAX_DISTANCE, hashImages, MAX_HASHED_IMAGES, nearDuplicatePairs,
  type ImageByteSource, type ImageDecoder, type ImageHashRow,
} from '@/services/multimodal';

const absolute = (src: string, base: string): string | null => {
  try { const url = new URL(src, base); return /^https?:$/u.test(url.protocol) ? url.href : null; } catch { return null; }
};

export const crawlImageUrls = (pages: CrawledPageSummary[]): string[] =>
  [...new Set(pages.flatMap((page) => page.images.map((image) => absolute(image.src, page.url)).filter((url): url is string => !!url)))];

type Status = 'idle' | 'running' | 'done' | 'cancelled';

/** On-demand pHash of the site's own images (#96). Evidence only: no score changes, no stock or authorship claim. */
export const CrawlImageNearDuplicates = ({ pages, t, source, decode }: { pages: CrawledPageSummary[]; t: TFunction; source?: ImageByteSource; decode?: ImageDecoder }) => {
  const urls = useMemo(() => crawlImageUrls(pages), [pages]);
  const [rows, setRows] = useState<ImageHashRow[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [maxDistance, setMaxDistance] = useState(DEFAULT_MAX_DISTANCE);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { controller.current?.abort(); controller.current = null; setRows([]); setStatus('idle'); }, [urls]);
  const run = async () => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setRows([]);
    setStatus('running');
    try {
      await hashImages(urls, { source, decode, signal: abort.signal, onRow: (row) => setRows((current) => [...current, row]) });
      if (!abort.signal.aborted) setStatus('done');
    } catch {
      if (controller.current === abort) setStatus('cancelled');
    }
  };
  const cancel = () => { controller.current?.abort(); setStatus('cancelled'); };
  const pairs = useMemo(() => nearDuplicatePairs(rows, maxDistance), [rows, maxDistance]);
  const failed = rows.filter((row) => row.status === 'failed');
  return (
    <section className="mb-3 space-y-2 rounded border border-slate-700 p-3 text-xs text-slate-300" data-testid="image-near-duplicates">
      <h4 className="font-semibold">{t('imagePhashUi.title')}</h4>
      <p>{t('imagePhashUi.note', { max: MAX_HASHED_IMAGES })}</p>
      <div className="flex flex-wrap items-center gap-2">
        {status === 'running'
          ? <button type="button" onClick={cancel} className="rounded border border-slate-600 px-2 py-1">{t('imagePhashUi.cancel')}</button>
          : <button type="button" disabled={!urls.length} onClick={() => void run()} className="rounded border border-slate-600 px-2 py-1 disabled:opacity-50">
            {t('imagePhashUi.run', { count: Math.min(urls.length, MAX_HASHED_IMAGES) })}</button>}
        <label>{t('imagePhashUi.threshold')}{' '}
          <input type="number" min={0} max={16} value={maxDistance} className="w-14 bg-slate-900"
            onChange={(event) => setMaxDistance(Math.max(0, Math.min(16, Number(event.currentTarget.value) || 0)))} />
        </label>
      </div>
      <p>{t('imagePhashUi.uncalibrated')}</p>
      {status !== 'idle' && <p role="status">{t(`imagePhashUi.status.${status}`, { hashed: rows.length - failed.length, failed: failed.length })}</p>}
      {failed.length > 0 && <p>{(['blocked', 'http-error', 'too-large', 'not-image', 'decode-failed', 'unsupported-url'] as const)
        .map((failure) => ({ failure, count: failed.filter((row) => row.status === 'failed' && row.failure === failure).length }))
        .filter((entry) => entry.count > 0).map((entry) => t(`imagePhashUi.failures.${entry.failure}`, { n: entry.count })).join(' · ')}</p>}
      {status !== 'idle' && <ul className="space-y-1 break-all">
        {pairs.map((pair) => <li key={`${pair.left}\n${pair.right}`}>
          {t(pair.identicalBytes ? 'imagePhashUi.identical' : 'imagePhashUi.pair', { left: pair.left, right: pair.right, distance: pair.distance })}
        </li>)}
        {!pairs.length && <li>{t('imagePhashUi.noPairs')}</li>}
      </ul>}
      <p>{t('imagePhashUi.external')}</p>
    </section>
  );
};
