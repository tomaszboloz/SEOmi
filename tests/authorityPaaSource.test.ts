import { describe, expect, it, vi } from 'vitest';
import advanced from './fixtures/dataforseoSerpAdvancedPaa.json';
import { getSerpWithQuestions, peopleAlsoAskOf, SERP_ADVANCED } from '@/services/dataforseo/dataforseoSerp';
import type { DataForSEOCore } from '@/services/dataforseo/dataforseoCore';
import { createSerpFetcher } from '@/services/siteFocusBenchmark';
import { buildTaxonomy } from '@/services/topicalAuthority';
import { COMPETITORS, NOW, ownReport } from './authorityFixtures';

const coreOf = () => {
  const sfs = ownReport();
  return { sfs, coreKeys: new Set(Object.entries(sfs.model.termCluster).filter(([, id]) => id === sfs.model.coreClusterId).map(([key]) => key)) };
};
const build = (paa: string[] | undefined, competitors = COMPETITORS) => {
  const { sfs, coreKeys } = coreOf();
  return buildTaxonomy({ coreLabel: sfs.coreTopic.label, coreKeys, language: sfs.model.language, competitors, suggestions: ['pour over brewing basics'], paa, source: 'dataforseo', now: NOW })!;
};

describe('People Also Ask from the real SERP (#57, #110)', () => {
  it('parses the PAA block of the advanced SERP fixture, deduplicated and blank-free', () => {
    expect(peopleAlsoAskOf(advanced.items)).toEqual(['How do you descale an espresso machine?', 'What grind size is best for pour over?']);
    expect(peopleAlsoAskOf(undefined)).toEqual([]);
    expect(peopleAlsoAskOf([{ type: 'organic', title: 'x' }])).toEqual([]);
  });

  it('requests the advanced endpoint and keeps organic rows apart from questions', async () => {
    const post = vi.fn(async () => [advanced]);
    const result = await getSerpWithQuestions({ post } as unknown as DataForSEOCore, 'espresso', 2616, 'pl');
    expect(post).toHaveBeenCalledWith(SERP_ADVANCED, [{ keyword: 'espresso', location_code: 2616, language_code: 'pl', depth: 100 }]);
    expect(result.organic.map((row) => row.domain)).toEqual(['rival-one.test', 'rival-two.test']);
    expect(result.questions).toHaveLength(2);
    const empty = await getSerpWithQuestions({ post: vi.fn(async () => []) } as unknown as DataForSEOCore, 'x');
    expect(empty).toEqual({ organic: [], questions: [] });
  });

  it('uses the advanced SERP only after opt-in and never for the free feed', async () => {
    const organic = [{ type: 'organic', rank_group: 1, rank_absolute: 1, domain: 'a.test', title: '', description: '', url: 'https://a.test/' }];
    const client = { getSerpCompetitors: vi.fn(async () => organic), getSerpWithQuestions: vi.fn(async () => ({ organic, questions: ['Why?'] })) };
    const env = { credentials: { login: 'l', password: 'p' }, country: 'PL', language: 'pl', dataForSeo: () => client, freeSerp: vi.fn() as never };
    expect(await createSerpFetcher(env)('kw')).not.toHaveProperty('questions');
    expect(client.getSerpWithQuestions).not.toHaveBeenCalled();
    const opted = await createSerpFetcher({ ...env, withQuestions: true })('kw');
    expect(opted).toMatchObject({ source: 'dataforseo', questions: ['Why?'], hits: [{ rank: 1, url: 'https://a.test/', domain: 'a.test' }] });
    // A client without the advanced method falls back to the regular SERP rather than failing.
    const regular = { getSerpCompetitors: vi.fn(async () => organic) };
    expect(await createSerpFetcher({ ...env, withQuestions: true, dataForSeo: () => regular })('kw')).not.toHaveProperty('questions');
  });

  it('marks PAA provenance, counts PAA as one more source and adds the questions', () => {
    const without = build(undefined);
    expect(without.paaCount).toBe(0);
    expect(without.subtopics.every((subtopic) => subtopic.sources?.paa === false)).toBe(true);
    const withPaa = build(['Which espresso machines buying guide?', 'Unrelated lonely question']);
    expect(withPaa.paaCount).toBe(2);
    const hit = withPaa.subtopics.find((subtopic) => subtopic.sources?.paa);
    expect(hit?.questions).toContain('Which espresso machines buying guide?');
    // A single-source PAA question is not enough evidence for its own sub-topic.
    expect(withPaa.subtopics.some((subtopic) => subtopic.label.includes('lonely'))).toBe(false);
    const count = hit!.sources!.domains.length + (hit!.sources!.suggest ? 1 : 0) + 1;
    expect(hit!.importance).toBeCloseTo(count / (withPaa.competitors.length + 2), 3);
  });

  it('keeps sub-topic IDs stable when sources arrive in another order', () => {
    const forward = build([]);
    const reversed = build([], [...COMPETITORS].reverse());
    const ids = (map: typeof forward) => Object.fromEntries(map.subtopics.map((subtopic) => [subtopic.keys.join(' '), subtopic.id]));
    expect(ids(reversed)).toEqual(ids(forward));
    expect(new Set(forward.subtopics.map((subtopic) => subtopic.id)).size).toBe(forward.subtopics.length);
  });
});
