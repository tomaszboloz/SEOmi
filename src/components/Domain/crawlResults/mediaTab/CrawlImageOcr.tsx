import { useEffect, useMemo, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import type { CrawledPageSummary } from '@/types';
import { MAX_OCR_IMAGES, ocrMediaFacts, runImageOcr, type ImageByteSource, type OcrRow } from '@/services/multimodal';
import { readStorage, writeStorage } from '@/services/storage';
import { absolute, crawlImageUrls } from './CrawlImageNearDuplicates';

const MODEL_KEY = 'seomi.multimodal.ocrModel';
type Status = 'idle' | 'running' | 'done' | 'cancelled' | 'error';

/** Opt-in OCR through a local Ollama vision model (#96). Off until a model name is entered; results stay partial. */
export const CrawlImageOcr = ({ pages, t, source, fetchImpl }: { pages: CrawledPageSummary[]; t: TFunction; source?: ImageByteSource; fetchImpl?: (input: string, init: RequestInit) => Promise<Response> }) => {
  const urls = useMemo(() => crawlImageUrls(pages), [pages]);
  const alts = useMemo(() => new Map(pages.flatMap((page) => page.images.map((image) => [absolute(image.src, page.url), image.alt] as const))), [pages]);
  const [model, setModel] = useState(() => readStorage(MODEL_KEY) ?? '');
  const [rows, setRows] = useState<OcrRow[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { controller.current?.abort(); setRows([]); setStatus('idle'); }, [urls]);
  const run = async () => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setRows([]);
    setStatus('running');
    const images = urls.map((url) => ({ url, alt: alts.get(url) }));
    try {
      await runImageOcr(images, pages, { model: model.trim(), signal: abort.signal, source, fetchImpl, onRow: (row) => setRows((current) => [...current, row]) });
      if (!abort.signal.aborted) setStatus('done');
    } catch {
      if (!abort.signal.aborted) setStatus('error');
    }
  };
  const facts = useMemo(() => ocrMediaFacts(rows, pages), [rows, pages]);
  const ok = rows.filter((row) => row.status === 'ok').length;
  return (
    <section className="mb-3 space-y-2 rounded border border-slate-700 p-3 text-xs text-slate-300" data-testid="image-ocr">
      <h4 className="font-semibold">{t('imageOcrUi.title')}</h4>
      <p>{t('imageOcrUi.note', { max: MAX_OCR_IMAGES })}</p>
      <label>{t('imageOcrUi.model')}{' '}
        <input value={model} placeholder="llama3.2-vision" className="bg-slate-900" disabled={status === 'running'}
          onChange={(event) => { setModel(event.currentTarget.value); writeStorage(MODEL_KEY, event.currentTarget.value.trim()); }} />
      </label>
      {status === 'running'
        ? <button type="button" onClick={() => { controller.current?.abort(); setStatus('cancelled'); }}>{t('imageOcrUi.cancel')}</button>
        : <button type="button" disabled={!model.trim() || !urls.length} onClick={() => void run()}>{t('imageOcrUi.run')}</button>}
      {status !== 'idle' && <p role="status">{t(`imageOcrUi.status.${status}`, { ok, failed: rows.length - ok })}</p>}
      <ul className="space-y-1 break-all">
        {facts.map((fact) => <li key={`${fact.text}-${fact.provenance.sourceUrl}`}>
          {t('imageOcrUi.fact', { text: fact.text, origin: t(`imageOcrUi.origin.${fact.origin}`), url: fact.provenance.sourceUrl })}</li>)}
        {rows.flatMap((row) => (row.status === 'ok' && row.alignment ? [<li key={`a-${row.url}`}>
          {t('imageOcrUi.alignment', { url: row.url, pct: Math.round(row.alignment.similarity * 100) })}</li>] : []))}
      </ul>
    </section>
  );
};
