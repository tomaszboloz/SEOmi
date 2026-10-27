import { describe, expect, it } from 'vitest';
import { chunkSections } from '@/services/aioReadiness/chunking';
import { scoreChunk } from '@/services/aioReadiness/chunkScore';
import { rulesFor } from '@/services/aioReadiness/languageRules';
import { AIO_CHUNK_OVERLAP, AIO_CHUNK_TOKENS } from '@/services/aioReadiness/types';
import type { RagSection } from '@/types';
import { section } from './aioFixtures';

const en = rulesFor('en').rules;
const makeWords = (count: number, tag: string): string =>
  Array.from({ length: count }, (_, i) => `${tag}${i}`).join(' ') + '.';

describe('AIO chunking: paragraph boundaries and empty sections', () => {
  it('omits sections with empty paragraph lists and filters them out of chunk stream', () => {
    const sections: RagSection[] = [
      section('Empty Header 1', []),
      section('Active Section', ['First valid paragraph with facts.', 'Second valid paragraph.']),
      section('Empty Header 2', []),
      section('Active Section 2', ['Third valid paragraph here.']),
    ];
    const chunks = chunkSections(sections);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].heading).toBe('Active Section');
    expect(chunks[0].paragraphs).toHaveLength(2);
    expect(chunks[1].heading).toBe('Active Section 2');
    expect(chunks[1].paragraphs).toHaveLength(1);
  });

  it('handles sections with empty string or whitespace paragraphs as 0-token chunks', () => {
    const sections: RagSection[] = [
      section('Whitespace Only', ['   ', '']),
    ];
    const chunks = chunkSections(sections);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].tokens).toBe(0);
    expect(chunks[0].paragraphs).toEqual(['   ', '']);
  });

  it('keeps paragraphs intact across window splits instead of slicing inside a paragraph', () => {
    const p1 = makeWords(200, 'first');
    const p2 = makeWords(120, 'second');
    const p3 = makeWords(50, 'third');
    const longSec = section('Split Section', [p1, p2, p3]);
    const chunks = chunkSections([longSec]);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].paragraphs).toEqual([p1]);
    expect(chunks[1].paragraphs).toEqual([p2, p3]);
    expect(chunks[0].paragraphs.join(' ')).not.toContain('second0');
  });

  it('preserves single oversized paragraph (>300 tokens) without splitting under legacy profile', () => {
    const hugeParagraph = makeWords(450, 'bulk');
    const sec = section('Unsplit Paragraph', [hugeParagraph]);
    const chunks = chunkSections([sec]);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].tokens).toBe(450);
    expect(chunks[0].tokens).toBeGreaterThan(AIO_CHUNK_TOKENS);
    expect(chunks[0].paragraphs[0]).toBe(hugeParagraph);
  });
});

describe('AIO chunking: stable provenance offsets in current contract', () => {
  it('resets windowIndex to 0 for each section and increments sequentially within multi-window sections', () => {
    const s1 = section('Sec1', [makeWords(200, 's1a'), makeWords(120, 's1b'), makeWords(50, 's1c')]);
    const s2 = section('Sec2', [makeWords(50, 's2a')]);
    const s3 = section('Sec3', [makeWords(200, 's3a'), makeWords(120, 's3b')]);

    const chunks = chunkSections([s1, s2, s3]);
    expect(chunks.map((c) => ({ heading: c.heading, windowIndex: c.windowIndex }))).toEqual([
      { heading: 'Sec1', windowIndex: 0 },
      { heading: 'Sec1', windowIndex: 1 },
      { heading: 'Sec2', windowIndex: 0 },
      { heading: 'Sec3', windowIndex: 0 },
      { heading: 'Sec3', windowIndex: 1 },
    ]);
  });

  it('carries exact previous paragraph into next window when <= AIO_CHUNK_OVERLAP tokens', () => {
    const p1 = makeWords(260, 'intro');
    const pOverlap = makeWords(AIO_CHUNK_OVERLAP - 20, 'bridge');
    const p3 = makeWords(100, 'detail');
    const sec = section('Bridge Heading', [p1, pOverlap, p3]);

    const chunks = chunkSections([sec]);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].paragraphs).toEqual([p1, pOverlap]);
    expect(chunks[1].paragraphs[0]).toBe(pOverlap);
    expect(chunks[1].paragraphs).toEqual([pOverlap, p3]);
  });

  it('does not carry previous paragraph into next window when > AIO_CHUNK_OVERLAP tokens', () => {
    const p1 = makeWords(180, 'heavy1');
    const pHeavy = makeWords(AIO_CHUNK_OVERLAP + 30, 'heavy2');
    const p3 = makeWords(80, 'heavy3');
    const sec = section('No Overlap Heading', [p1, pHeavy, p3]);

    const chunks = chunkSections([sec]);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].paragraphs).toEqual([p1, pHeavy]);
    expect(chunks[1].paragraphs).toEqual([p3]);
    expect(chunks[1].paragraphs[0]).toBe(p3);
  });

  it('produces deterministic output and preserves paragraph text fidelity in scored AioChunk', () => {
    const p1 = '🩺 Fasting blood glucose measures 70 to 99 mg/dl in healthy adults.';
    const p2 = '💉 Continuous glucose monitoring provides real-time sensor readings.\r\nAlerts trigger reliably.';
    const sec = section('Glucose Baseline', [p1, p2]);

    const run1 = chunkSections([sec]);
    const run2 = chunkSections([sec]);
    expect(run1).toEqual(run2);

    const scored = scoreChunk(run1[0], en);
    expect(scored.text).toBe(`${p1}\n${p2}`);
    expect(scored.windowIndex).toBe(0);
    expect(scored.heading).toBe('Glucose Baseline');

    // Deterministic source-span reconstruction (UTF-16 code unit offsets with CRLF & emoji) without invented fields
    const sourceText = sec.paragraphs.join('\r\n');
    let cursor = 0;
    for (const paragraph of run1[0].paragraphs) {
      const start = sourceText.indexOf(paragraph, cursor);
      expect(start).toBeGreaterThanOrEqual(cursor);
      const end = start + paragraph.length;
      expect(sourceText.slice(start, end)).toBe(paragraph);
      cursor = end;
    }
  });
});
