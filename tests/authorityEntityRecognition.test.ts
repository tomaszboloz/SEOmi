import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTaxonomy, heuristicEntities, type CompetitorPages } from '@/services/topicalAuthority';
import { extractEntitiesWithChat, parseEntityList, createOllamaEntityChat, ENTITY_OLLAMA_URL } from '@/services/topicalAuthorityReference/ollamaEntities';
import { readEntitySettings, writeEntitySettings } from '@/services/topicalAuthorityMonitoring';
import { runReference } from '@/services/topicalAuthorityReference';
import { COFFEE, NOW, OWN_HOST, coffeePage, ownReport, ownSite } from './authorityFixtures';

beforeEach(() => localStorage.clear());

describe('heuristic entity recognition (#58 GEM-58-04)', () => {
  it('finds names, acronyms and model codes and skips the capitalised first word', () => {
    expect(heuristicEntities('Best Espresso machines from La Marzocco and Rancilio')).toEqual(['espresso', 'la marzocco', 'rancilio']);
    expect(heuristicEntities('SCA standards for the Sony A7IV')).toEqual(['sca', 'sony a7iv']);
    expect(heuristicEntities('how to use the ASCII table')).toEqual(['ascii']);
    expect(heuristicEntities('Guide: Cold Brew Coffee')).toEqual(['cold brew coffee']);
    expect(heuristicEntities('Intro to Alpha Beta Gamma Delta Epsilon')).toEqual(['alpha beta gamma delta', 'epsilon']);
    expect(heuristicEntities('go to X in it')).toEqual([]);
    expect(heuristicEntities('エスプレッソ 入門')).toEqual([]);
  });
});

const rivals = (host: string, h2: string): CompetitorPages => ({ domain: host, pages: ['/a', '/b'].map((path) => coffeePage(host, { path, title: `Espresso ${path}`, h2: [h2, 'Brewing with Rancilio Silvia'], terms: COFFEE, noUnique: true })) });
const input = (entities?: { heuristic?: boolean; extra?: string[] }) => {
  const sfs = ownReport(ownSite());
  return buildTaxonomy({ coreLabel: sfs.coreTopic.label, coreKeys: new Set(), language: 'en', competitors: [rivals('one.test', 'Espresso machine basics'), rivals('two.test', 'Espresso machine basics')], suggestions: [], source: 'x', now: NOW, entities });
};

describe('taxonomy entity modes', () => {
  const all = (taxonomy: ReturnType<typeof input>) => taxonomy!.subtopics.flatMap((item) => item.entities);
  it('keeps lexical entities by default and adds recognised names on request', () => {
    expect(all(input())).not.toContain('rancilio silvia');
    expect(all(input({ heuristic: true }))).toContain('rancilio silvia');
  });
  it('matches model-supplied names against page text only and ignores short or absent names', () => {
    const names = all(input({ extra: ['Rancilio Silvia', 'No Such Name', 'ab'] }));
    expect(names).toContain('rancilio silvia');
    expect(names).not.toContain('no such name');
    expect(names).not.toContain('ab');
    expect(all(input({ heuristic: false }))).not.toContain('rancilio silvia');
  });
});

describe('entity recognition on sparse pages', () => {
  it('copes with pages without title or H1 and with names that have no term key', () => {
    const sparse = (host: string): CompetitorPages => ({ domain: host, pages: ['/a', '/b'].map((path) => {
      const page = coffeePage(host, { path, title: 'x', h2: ['Espresso machine basics', 'See the Rancilio Silvia'], terms: COFFEE, noUnique: true });
      delete (page as { title?: string }).title;
      page.heading_texts = { h2: page.heading_texts?.h2 ?? [] } as typeof page.heading_texts;
      return page;
    }) });
    const sfs = ownReport(ownSite());
    const taxonomy = buildTaxonomy({ coreLabel: sfs.coreTopic.label, coreKeys: new Set(), language: 'en', competitors: [sparse('one.test'), sparse('two.test')], suggestions: [], source: 'x', now: NOW, entities: { heuristic: true, extra: ['the'] } });
    expect(taxonomy!.subtopics.flatMap((item) => item.entities)).toContain('rancilio silvia');
  });
});

describe('optional Ollama recogniser', () => {
  it('parses only a JSON string array and bounds it', () => {
    expect(parseEntityList('Sure: ["Rancilio Silvia", " La Marzocco ", "ab", 4, "Rancilio Silvia"] done')).toEqual(['Rancilio Silvia', 'La Marzocco']);
    expect(parseEntityList('no list here')).toEqual([]);
    expect(parseEntityList('[not json]')).toEqual([]);
    expect(parseEntityList('{"a":1}')).toEqual([]);
    expect(parseEntityList(`[${Array.from({ length: 300 }, (_, i) => `"entity ${i}"`).join(',')}]`)).toHaveLength(200);
    expect(parseEntityList(`["${'x'.repeat(81)}"]`)).toEqual([]);
  });
  it('sends bounded unique headings and never throws', async () => {
    const chat = vi.fn().mockResolvedValue({ text: '["Gaggia Classic"]' });
    const texts = ['Gaggia Classic review', 'Gaggia Classic review', ' ', ...Array.from({ length: 400 }, (_, i) => `Heading ${i} ${'y'.repeat(60)}`)];
    expect(await extractEntitiesWithChat(texts, chat)).toEqual(['Gaggia Classic']);
    const content = chat.mock.calls[0][0][0].content as string;
    expect(content.split('Gaggia Classic review').length).toBe(2);
    expect(content.length).toBeLessThan(12_400);
    expect(await extractEntitiesWithChat(['x'], vi.fn().mockRejectedValue(new Error('offline')))).toEqual([]);
  });
  it('builds a chat bound to the local server', () => {
    expect(ENTITY_OLLAMA_URL).toBe('http://127.0.0.1:11434');
    expect(typeof createOllamaEntityChat('llama3.2')).toBe('function');
  });
});

describe('per-project entity settings', () => {
  it('defaults to lexical, persists, sanitises and rejects invalid projects', () => {
    expect(readEntitySettings('e1')).toEqual({ mode: 'lexical', model: '' });
    expect(writeEntitySettings('e1', { mode: 'ollama', model: ' llama3.2 ' })).toBe(true);
    expect(readEntitySettings('e1')).toEqual({ mode: 'ollama', model: 'llama3.2' });
    localStorage.setItem('seomi_project_e2_authority_entities_v1', JSON.stringify({ mode: 'gpt', model: 5 }));
    expect(readEntitySettings('e2')).toEqual({ mode: 'lexical', model: '' });
    expect(writeEntitySettings(null, { mode: 'heuristic', model: '' })).toBe(false);
    expect(readEntitySettings(null)).toEqual({ mode: 'lexical', model: '' });
  });
});

describe('reference run entity modes', () => {
  const pages = ownSite();
  const base = {
    fetchSerp: async () => ({ source: 'dataforseo', hits: [{ rank: 1, url: 'https://one.test/', domain: 'one.test' }, { rank: 2, url: 'https://two.test/', domain: 'two.test' }] }),
    crawlSite: async ({ url }: { url: string }) => ({ pages: rivals(url.includes('one') ? 'one.test' : 'two.test', 'Espresso machine basics').pages }),
    now: () => NOW,
  };
  const run = (entityMode: 'lexical' | 'heuristic' | 'ollama', extractEntities?: (texts: string[]) => Promise<string[]>) =>
    runReference({ ...base, extractEntities }, { report: ownReport(pages), startUrl: `https://${OWN_HOST}/`, pages, maxQueries: 1, entityMode });
  const names = (outcome: Awaited<ReturnType<typeof run>>) => (outcome.status === 'ok' ? outcome.taxonomy.subtopics.flatMap((item) => item.entities) : []);

  it('uses recognised names only when the mode asks for them', async () => {
    expect(names(await run('lexical'))).not.toContain('rancilio silvia');
    expect(names(await run('heuristic'))).toContain('rancilio silvia');
    expect(names(await runReference(base, { report: ownReport(pages), startUrl: `https://${OWN_HOST}/`, pages, maxQueries: 1 }))).not.toContain('rancilio silvia');
  });
  it('asks the local model in ollama mode and survives its failure or absence', async () => {
    const ask = vi.fn().mockResolvedValue(['Brewing with Rancilio']);
    expect(names(await run('ollama', ask))).toContain('brewing with rancilio');
    expect(ask).toHaveBeenCalledOnce();
    expect(names(await run('ollama', vi.fn().mockRejectedValue(new Error('x'))))).toContain('rancilio silvia');
    expect(names(await run('ollama'))).toContain('rancilio silvia');
  });
});
