import { describe, expect, it } from 'vitest';
import { AIO_PDF_FACTS, buildAioReport, pdfPassage, summarizeAio, type AioChunk } from '@/services/aioReadiness';
import { WEAK_PAGE } from './aioFixtures';

const chunk = (extra: Partial<AioChunk> = {}): AioChunk & { url: string } => ({
  url: 'https://a.test/p', heading: 'H', level: 2, text: 'Text.', tokens: 1, windowIndex: 0,
  score: 40, selfContainment: 0.456, answerFirst: 0.2, triples: 0, issues: ['no-facts'], ...extra,
});

describe('AIO PDF passage inspector DTO (#64 GEM-64-08)', () => {
  it('carries components as 0-100, offsets and capped SPO facts with negation', () => {
    const facts = Array.from({ length: 5 }, (_, i) => ({ subject: `S${i}`, predicate: 'is', object: `O${i}`, negated: i === 0, quality: 1 as const }));
    const out = pdfPassage(chunk({ spoDensity: 0.25, offsets: { start: 4, end: 30, unit: 'utf16' }, spoTriples: facts }));
    expect(out).toMatchObject({ self_containment: 46, spo_density: 25, answer_first: 20, answer_first_applicable: true, offset_start: 4, offset_end: 30 });
    expect(out.facts).toHaveLength(AIO_PDF_FACTS);
    expect(out.facts[0]).toEqual({ subject: 'S0', predicate: 'is', object: 'O0', negated: true });
    expect(out.facts[1].negated).toBe(false);
  });

  it('keeps unknown components and offsets null instead of zero', () => {
    const out = pdfPassage(chunk({ selfContainment: Number.NaN, spoDensity: undefined, offsets: { start: 9, end: 2, unit: 'utf16' } }));
    expect(out.self_containment).toBeNull();
    expect(out.spo_density).toBeNull();
    expect(out.offset_start).toBeNull();
    expect(out.offset_end).toBeNull();
    expect(out.facts).toEqual([]);
    const bare = pdfPassage(chunk({ spoTriples: [{ subject: 'S', object: 'O' } as never] }));
    expect(bare.facts).toEqual([{ subject: 'S', predicate: '', object: 'O', negated: false }]);
  });

  it('reports Answer-First as not applicable for continuation windows', () => {
    const out = pdfPassage(chunk({ answerFirstAvailability: 'not-applicable', answerFirst: 1 }));
    expect(out.answer_first).toBeNull();
    expect(out.answer_first_applicable).toBe(false);
  });

  it('clamps out-of-range ratios and truncates long excerpts', () => {
    const out = pdfPassage(chunk({ selfContainment: 1.4, answerFirst: -0.2, text: 'y'.repeat(300) }));
    expect(out.self_containment).toBe(100);
    expect(out.answer_first).toBe(0);
    expect(out.excerpt.endsWith('…')).toBe(true);
  });

  it('is what summarizeAio emits for real engine passages', () => {
    const summary = summarizeAio(buildAioReport([WEAK_PAGE]));
    const [passage] = summary.passages;
    expect(passage.self_containment).toEqual(expect.any(Number));
    expect(passage.offset_start).toEqual(expect.any(Number));
    expect(passage.issues.length).toBeGreaterThan(0);
  });
});
