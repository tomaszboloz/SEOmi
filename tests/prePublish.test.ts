import { describe, expect, it } from 'vitest';
import { normalize } from '@/services/embeddings/vector';
import { chunkIssues } from '@/services/prePublish/chunks';
import { checkDraft, draftTrs, type CorpusPage } from '@/services/prePublish/check';

const v = (...x: number[]) => normalize(x);
const page = (url: string, vec = v(1, 0), over: Partial<CorpusPage> = {}): CorpusPage => ({ url, vector: vec, trs: 80, weight: 1, type: 'article', ...over });
const corpus = [page('a', v(1, 0.5)), page('b', v(0.5, 1)), page('c', v(0, 1), { trs: 30 })];
const long = Array.from({ length: 25 }, () => 'word').join(' ');
const draft = (vec = v(1, 0), over = {}) => ({ url: 'new', vector: vec, chunks: [`Own ${long}`], ...over });

describe('chunkIssues', () => {
  it('flags leading pronouns and short chunks', () => {
    expect(chunkIssues([`It ${long}`, 'Short text', `Fine ${long}`])).toEqual([
      { index: 0, kind: 'leading-pronoun' }, { index: 1, kind: 'too-short' },
    ]);
    expect(chunkIssues([`To jest ${long}`])[0].kind).toBe('leading-pronoun');
    expect(chunkIssues([`Tomato ${long}`])).toEqual([]);
  });
});

describe('checkDraft', () => {
  it('is insufficient without core, corpus or matching dimensions', () => {
    expect(checkDraft(draft(), corpus, null).reasons).toEqual(['no-core']);
    expect(checkDraft(draft(), corpus.slice(0, 1), v(1, 0)).reasons).toEqual(['corpus-too-small']);
    const r = checkDraft(draft(v(1, 0, 0)), corpus, v(1, 0));
    expect(r.reasons).toEqual(['dimension-mismatch']);
    expect(r.publishApproved).toBe(false);
    expect(checkDraft(draft(), [...corpus.slice(0, 2), page('z', v(1, 0, 0))], v(1, 0)).verdict).toBe('insufficient');
  });
  it('computes signed SFS delta without mutating the corpus', () => {
    const snapshot = JSON.stringify(corpus);
    const up = checkDraft(draft(v(1, 0.2)), corpus, v(1, 0));
    expect(JSON.stringify(corpus)).toBe(snapshot);
    expect(up.sfsDelta).toBeGreaterThan(0);
    expect(up.draftTrs).toBe(draftTrs(draft(v(1, 0.2)), v(1, 0)));
    const down = checkDraft(draft(v(0.3, -1)), corpus, v(1, 0));
    expect(down.sfsDelta).toBeLessThan(0);
    expect(down.reasons).toContain('low-trs');
    expect(down.verdict).toBe('review');
  });
  it('detects cannibalization, overlap and ignores different intent', () => {
    const near = [page('a', v(1, 0)), page('b', v(1, 0.5)), page('c', v(1, 0.2))];
    const r = checkDraft(draft(v(1, 0.01)), near, v(1, 0));
    expect(r.conflicts[0]).toMatchObject({ url: 'a', level: 'conflict' });
    expect(r.verdict).toBe('blocked');
    const overlap = checkDraft(draft(v(1, 0), { url: 'a' }), [page('a'), page('b', v(1, 0.57)), page('c', v(0, 1))], v(1, 0));
    expect(overlap.conflicts.map((c) => c.level)).toContain('overlap');
    expect(overlap.reasons).toContain('overlap');
    const other = checkDraft(draft(v(1, 0.01), { intent: 'buy' }), [page('a', v(1, 0), { intent: 'info' }), page('b'), page('c', v(1, 0.2), { intent: 'buy' })].map((p) => ({ ...p, vector: p.url === 'b' ? v(0, 1) : p.vector })), v(1, 0));
    expect(other.conflicts.some((c) => c.url === 'a')).toBe(false);
    expect(other.conflicts.some((c) => c.url === 'c')).toBe(true);
  });
  it('approves a clean draft and flags chunk issues', () => {
    const ok = checkDraft(draft(v(1, 0.1)), [page('a', v(0, 1)), page('b', v(0, 1)), page('c', v(0, 1))], v(1, 0));
    expect(ok.verdict).toBe('ok');
    expect(ok.publishApproved).toBe(true);
    const bad = checkDraft(draft(v(1, 0.1), { chunks: ['It is short'] }), corpus.slice(0, 3), v(1, 0));
    expect(bad.reasons).toContain('chunk-issues');
    expect(bad.publishApproved).toBe(false);
  });
});
