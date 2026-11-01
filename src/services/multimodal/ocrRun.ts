import type { CrawledPageSummary } from '@/types';
import { nativeImageSource } from './nativeImageSource';
import { sha256Hex, type ImageByteSource, type ImageFailure } from './imageBytes';
import { createLexicalAlignmentProvider } from './lexicalAlignment';
import { mergeMediaFacts, type MediaFact } from './mediaFacts';
import type { AlignmentArtifact, OcrArtifact } from './modelProviders';
import { createOllamaOcrProvider } from './ollamaVisionOcr';

export const MAX_OCR_IMAGES = 10;

export type OcrRow =
  | { url: string; status: 'ok'; ocr: OcrArtifact[]; alignment: AlignmentArtifact | null }
  | { url: string; status: 'failed'; failure: ImageFailure | 'model-error' };

export interface OcrRunOptions { model: string; signal: AbortSignal; baseUrl?: string; source?: ImageByteSource; fetchImpl?: (input: string, init: RequestInit) => Promise<Response>; onRow?: (row: OcrRow) => void }

/** Text a crawl already holds as HTML evidence: title, description and headings. */
export const pageHtmlText = (pages: CrawledPageSummary[]): string => pages.flatMap((page) => [page.title ?? '', page.meta_description ?? '',
  ...(page.heading_texts ? [...page.heading_texts.h1, ...page.heading_texts.h2, ...page.heading_texts.h3] : [])]).filter(Boolean).join('\n');

/** Opt-in OCR through a local Ollama vision model; sequential and bounded, never a mandatory download. */
export const runImageOcr = async (images: Array<{ url: string; alt?: string }>, pages: CrawledPageSummary[], options: OcrRunOptions): Promise<OcrRow[]> => {
  const provider = createOllamaOcrProvider({ model: options.model, baseUrl: options.baseUrl, fetchImpl: options.fetchImpl });
  const alignment = createLexicalAlignmentProvider();
  const source = options.source ?? nativeImageSource();
  const paragraph = pageHtmlText(pages);
  const rows: OcrRow[] = [];
  for (const image of images.slice(0, MAX_OCR_IMAGES)) {
    options.signal.throwIfAborted();
    const fetched = await source.fetch(image.url, options.signal);
    let row: OcrRow;
    if (!fetched.ok) row = { url: image.url, status: 'failed', failure: fetched.failure };
    else {
      const input = { url: image.url, bytes: fetched.bytes, contentHash: await sha256Hex(fetched.bytes), context: { alt: image.alt, paragraph } };
      try {
        row = { url: image.url, status: 'ok', ocr: await provider.analyze(input, options.signal), alignment: await alignment.analyze(input, options.signal).catch(() => null) };
      } catch {
        options.signal.throwIfAborted();
        row = { url: image.url, status: 'failed', failure: 'model-error' };
      }
    }
    rows.push(row);
    options.onRow?.(row);
  }
  return rows;
};

export const ocrMediaFacts = (rows: OcrRow[], pages: CrawledPageSummary[]): MediaFact[] =>
  mergeMediaFacts(pageHtmlText(pages), rows.flatMap((row) => (row.status === 'ok' ? row.ocr : [])), []).facts;
