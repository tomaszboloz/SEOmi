import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { entitiesFromText, entityCandidates, entityVocabulary } from '@/services/igos/entities';
import { chunkSections } from '@/services/igos/sections';
import { buildPhraseIgosWithSettings, SEMANTIC_PROVIDER_UNAVAILABLE } from '@/services/igos/phraseIgosProvider';
import { compareIgosRuns, loadIgosHistory, recordIgosRun, type IgosHistoryEntry } from '@/services/igos/history';
import { IgosRunDetails, sourceZoneCounts } from '@/components/Results/igos/IgosRunDetails';
import type { IgosReport } from '@/services/igos/report';
import type { TopTenCorpus } from '@/services/targetPhraseAudit/types';

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('IGOS entities: heuristic NER + SPO with alias collapse (#67 GEM-67-03)', () => {
  it('finds capitalised spans and SPO subjects as stem keys', () => {
    const keys = entityCandidates('Guidance from the World Health Organization. Insulin pumps are devices for 24 hours.');
    expect(keys).toContain('world health organ');
    expect(keys).toContain('insulin pumps');
    expect(entityCandidates('nothing here', 'xx')).toEqual([]);
  });
  it('matches the shared vocabulary once and does not recount its words', () => {
    const vocabulary = entityVocabulary(['The Insulin Pumps guide']);
    const entities = entitiesFromText('an insulin pumps review: insulin dosing', vocabulary);
    expect(entities).toContain('insulin pumps');
    expect(entities.filter((entity) => entity === 'pump' || entity === 'pumps')).toEqual([]);
    expect(entities).toContain('insulin');
  });
});

describe('section-aware chunks (#67)', () => {
  it('splits at located H2/H3 headings and keeps offsets into the text', () => {
    const text = 'Intro words here. Dosage Each dose is small. Storage Keep it cold.';
    const chunks = chunkSections(text, ['Dosage', 'Missing heading', 'Storage']);
    expect(chunks.map((chunk) => chunk.heading)).toEqual([null, 'Dosage', 'Storage']);
    chunks.forEach((chunk) => expect(text.slice(chunk.offset, chunk.offset + 5)).toBe(chunk.text.slice(0, 5)));
    expect(chunkSections('a b', [])).toEqual([{ text: 'a b', offset: 0, heading: null }]);
  });
});

const words = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i % 7}`).join(' ');
const corpus: TopTenCorpus = {
  target: { url: 'https://me.test/', text: `${words('coffee', 90)} grinder 12 g we tested`, wordCount: 100 },
  pages: [1, 2, 3].map((rank) => ({ rank, url: `https://c${rank}.test/`, fetchedAt: '2026-10-29T00:00:00Z', status: 200, text: words('coffee', 80) })),
  requested: 3,
};

describe('IGOS with the project embedding provider (#86)', () => {
  it('uses the semantic provider identity when it works', async () => {
    const report = await buildPhraseIgosWithSettings(corpus, { provider: 'ollama', ollamaModel: 'bge-m3' }, {}, () => ({ id: 'ollama', model: 'bge-m3', embed: async (texts) => texts.map(() => Float64Array.from([1, 0])) }));
    expect(report?.provenance).toMatchObject({ provider: 'ollama', model: 'bge-m3' });
    expect(report?.limitations).not.toContain('local-lexical-embeddings');
  });
  it('falls back to labelled local vectors when the provider fails', async () => {
    const report = await buildPhraseIgosWithSettings(corpus, { provider: 'ollama' }, {}, () => ({ id: 'ollama', model: 'm', embed: async () => { throw new Error('offline'); } }));
    expect(report?.limitations).toEqual(expect.arrayContaining(['local-lexical-embeddings', SEMANTIC_PROVIDER_UNAVAILABLE, 'heuristic-entities']));
    expect(report?.provenance?.provider).toBe('local-hash');
    expect((await buildPhraseIgosWithSettings(corpus, { provider: 'local' }))?.provenance?.docs).toHaveLength(3);
  });
});

const entry = (patch: Partial<IgosHistoryEntry> = {}): IgosHistoryEntry => ({
  runAt: '2026-10-30T10:00:00Z', targetUrl: 'https://me.test/', provider: 'ollama', model: 'm', igos: 40, status: 'ready', availableDocs: 3, requestedDocs: 3, docUrls: ['a', 'b'], ...patch,
});

describe('IGOS history and baseline alerts (#68 GEM-68-06)', () => {
  it('compares only runs on the same model and flags a changed TOP set', () => {
    expect(compareIgosRuns(entry(), undefined)).toEqual({ kind: 'first' });
    expect(compareIgosRuns(entry(), entry({ model: 'other' })).kind).toBe('model-changed');
    expect(compareIgosRuns(entry(), entry({ igos: 30 }))).toMatchObject({ kind: 'same-basis', delta: 10 });
    expect(compareIgosRuns(entry(), entry({ docUrls: ['a', 'c'], igos: 30 }))).toMatchObject({ kind: 'baseline-changed', delta: 10 });
    expect(compareIgosRuns(entry(), entry({ docUrls: ['a'] })).kind).toBe('baseline-changed');
    expect(compareIgosRuns(entry({ igos: null }), entry())).toMatchObject({ delta: null });
  });
  it('stores runs per project and phrase, newest first, and renders the drill-down', async () => {
    const report = await buildPhraseIgosWithSettings(corpus, { provider: 'local' }, { now: () => '2026-10-30T09:00:00Z' }) as IgosReport;
    expect(recordIgosRun(null, 'kawa', report)).toEqual([]);
    recordIgosRun('p1', 'Kawa', report);
    const second = { ...report, provenance: { ...report.provenance!, runAt: '2026-10-30T11:00:00Z', model: 'other' } };
    const history = recordIgosRun('p1', ' kawa ', second);
    expect(history.map((row) => row.runAt)).toEqual(['2026-10-30T11:00:00Z', '2026-10-30T09:00:00Z']);
    expect(loadIgosHistory('p2', 'kawa')).toEqual([]);
    expect(sourceZoneCounts(report, 'https://c1.test/').echo + sourceZoneCounts(report, 'https://c1.test/').gain).toBeGreaterThanOrEqual(0);
    render(<IgosRunDetails report={second} history={history} />);
    expect(screen.getByText(/A model change is not a drop in page quality/)).toBeTruthy();
    expect(screen.getByText('Compared pages (3)')).toBeTruthy();
    expect(screen.getByText('Stored runs (2)')).toBeTruthy();
  });
});
