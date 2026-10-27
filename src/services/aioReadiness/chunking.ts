import type { RagSection } from '@/types';
import { tokenCount } from './text';
import { AIO_CHUNK_OVERLAP, AIO_CHUNK_TOKENS } from './types';

export interface RawChunk {
  heading: string;
  level: number;
  paragraphs: string[];
  tokens: number;
  windowIndex: number;
}

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
