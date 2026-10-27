import type { RagSection } from '@/types';
import { boundedSpans, sentenceSpans, tokenCount } from './text';
import { AIO_CHUNK_OVERLAP, AIO_CHUNK_TOKENS } from './types';

export interface RawChunk {
  heading: string;
  level: number;
  paragraphs: string[];
  tokens: number;
  windowIndex: number;
  offsets?: { start: number; end: number; unit: 'utf16' };
  oversizedSentence?: boolean;
  coreTerms?: string[];
}

export interface AioChunkingOptions {
  maxWords?: number;
  targetWords?: number;
  overlapWords?: number;
  coreTerms?: string[];
}

const sizeOf = (text: string, charBased: boolean): number => tokenCount(text, charBased);

/**
 * Simulates RAG chunking: one chunk per heading section, long sections split into ~300-token
 * windows on paragraph boundaries. The last paragraph is carried into the next window when it
 * fits the overlap budget, as sliding-window indexers do.
 */
export const chunkSections = (sections: RagSection[], charBased = false): RawChunk[] => {
  const chunks: RawChunk[] = [];
  sections.forEach((section) => {
    const sizes = section.paragraphs.map((paragraph) => tokenCount(paragraph, charBased));
    let window: number[] = [];
    let windowIndex = 0;
    const flush = (): void => {
      if (!window.length) return;
      chunks.push({
        heading: section.heading,
        level: section.level,
        paragraphs: window.map((index) => section.paragraphs[index]),
        tokens: window.reduce((sum, index) => sum + sizes[index], 0),
        windowIndex: windowIndex++,
      });
    };
    sizes.forEach((size, index) => {
      const total = window.reduce((sum, item) => sum + sizes[item], 0);
      if (window.length && total + size > AIO_CHUNK_TOKENS) {
        const last = window[window.length - 1];
        flush();
        window = sizes[last] <= AIO_CHUNK_OVERLAP ? [last] : [];
      }
      window.push(index);
    });
    flush();
  });
  return chunks;
};
/** AIO-R chunking: sentence boundaries, target 180 words, hard 250-word cap when possible. */
export const chunkSectionsAioR = (sections: RagSection[], charBased = false, options: AioChunkingOptions = {}): RawChunk[] => {
  const max = options.maxWords ?? 250;
  const target = options.targetWords ?? 180;
  const overlap = options.overlapWords ?? 30;
  const chunks: RawChunk[] = [];
  sections.forEach((section) => {
    const source = section.paragraphs.join('\n\n');
    const sentences = sentenceSpans(source).flatMap((sentence) => {
      if (sizeOf(sentence.text, charBased) <= max) return [{ ...sentence, oversized: false }];
      return boundedSpans(sentence.text, max, charBased).map((part) => ({
        text: part.text,
        start: sentence.start + part.start,
        end: sentence.start + part.end,
        oversized: true,
      }));
    });
    if (!sentences.length) return;
    let start = 0;
    let windowIndex = 0;
    while (start < sentences.length) {
      let end = start;
      let count = 0;
      while (end < sentences.length) {
        const size = sizeOf(sentences[end].text, charBased);
        if (end > start && count + size > target) break;
        if (end > start && count + size > max) break;
        count += size;
        end += 1;
        if (size > max) break;
      }
      if (end === start) end += 1;
      const first = sentences[start];
      const last = sentences[end - 1];
      const text = source.slice(first.start, last.end);
      chunks.push({
        heading: section.heading,
        level: section.level,
        paragraphs: [text],
        tokens: tokenCount(text, charBased),
        windowIndex: windowIndex++,
        offsets: { start: first.start, end: last.end, unit: 'utf16' },
        oversizedSentence: sentences.slice(start, end).some((sentence) => sentence.oversized),
        coreTerms: options.coreTerms,
      });
      if (end >= sentences.length) break;
      let carry = 0;
      let next = end;
      while (next > start && carry < overlap) {
        next -= 1;
        carry += sizeOf(sentences[next].text, charBased);
      }
      start = Math.max(start + 1, next);
    }
  });
  return chunks;
};
