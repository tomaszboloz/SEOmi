import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadAuditPdf } from '@/services/export';
import { clearPhraseInsights, phraseInsightsFor, setPhraseIgos, setPhraseSija } from '@/services/export/phraseInsights';
import type { IgosReport } from '@/services/igos/report';
import type { PhraseIntentReport } from '@/services/sija/phraseIntent';
import { invokeTauriCommand } from '@/services/tauri';
import { audit } from './fixtures/export';

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn() }));
vi.mock('@/services/download', () => ({ downloadBlob: vi.fn() }));
afterEach(() => { vi.resetAllMocks(); clearPhraseInsights(); });

const chunk = (zone: 'echo' | 'gain' | 'drift' | 'neutral') => ({ chunk: { text: 'competitor-free', offset: 0, heading: null, vector: new Float64Array(1) }, topic: 0.5, nearest: 0.9, zone, evidence: null });
const igos = (patch: Partial<IgosReport> = {}): IgosReport => ({
  status: 'ready', igos: 42, components: { nefr: 0.4, edsi: 0, fhem: 0.2, sdd: 0.1 }, coverage: 0.6, multiplier: 1, onTopicShare: 0.8,
  availableDocs: 4, requestedDocs: 10, novelEntities: ['A', 'B'], zones: [chunk('echo'), chunk('echo'), chunk('gain')], limitations: ['heuristic-entities'],
  provenance: { provider: 'local-hash', model: 'local-lexical', runAt: '2026-10-01T00:00:00Z', targetUrl: 'u', docs: [] }, ...patch,
});
const sija = { page: { primary: 'how-to', mixed: [], confidence: 0.7, scores: {}, evidence: [] }, ssas: { status: 'aligned', score: 70, benchmarkPages: 3 },
  funnel: { TOFU: 2, MOFU: 1, BOFU: 0 }, requested: 5, analysed: 3, gaps: [{ format: 'table', topPages: 2, analysed: 3 }],
  serpIntent: { intent: 'how-to', pages: 2 }, intentMatch: 'match', topPages: [] } as unknown as PhraseIntentReport;

describe('phrase insights for the audit PDF (#68, #69)', () => {
  it('keeps numbers only: zone counts, component values and provenance, never paragraph text', () => {
    setPhraseIgos('https://a.pl/', 'kawa', igos());
    const stored = phraseInsightsFor(' https://a.pl/ ');
    expect(stored?.igos).toMatchObject({ igos: 42, zones: { echo: 2, gain: 1, drift: 0, neutral: 0 }, novelEntities: 2, provider: 'local-hash', runAt: '2026-10-01T00:00:00Z' });
    expect(JSON.stringify(stored)).not.toContain('competitor-free');
    setPhraseIgos('https://b.pl/', 'kawa', igos({ provenance: undefined, components: null }));
    expect(phraseInsightsFor('https://b.pl/')?.igos).toMatchObject({ provider: null, model: null, runAt: null, components: null });
  });

  it('merges IGOS and SIJA of one phrase, replaces on a new phrase and clears with null', () => {
    setPhraseIgos('u', 'kawa', igos());
    setPhraseSija('u', 'kawa', sija);
    expect(phraseInsightsFor('u')).toMatchObject({ phrase: 'kawa', igos: { igos: 42 }, sija: { intent: 'how-to', ssas: 70, gaps: [{ format: 'table' }] } });
    setPhraseSija('u', 'herbata', sija);
    expect(phraseInsightsFor('u')?.igos).toBeUndefined();
    setPhraseSija('u', 'herbata', null);
    expect(phraseInsightsFor('u')).toBeNull();
    setPhraseIgos('', 'x', igos());
    setPhraseIgos('u', ' ', igos());
    expect(phraseInsightsFor('u')).toBeNull();
  });

  it('attaches phrase insights of the audited URL to the native PDF payload, and nothing otherwise', async () => {
    vi.mocked(invokeTauriCommand).mockResolvedValue(btoa('%PDF-fixture'));
    await downloadAuditPdf(audit);
    expect(vi.mocked(invokeTauriCommand).mock.calls[0][1]).not.toHaveProperty('audit.phrase_insights');
    setPhraseIgos(audit.final_url, 'kawa', igos());
    await downloadAuditPdf(audit);
    expect(vi.mocked(invokeTauriCommand).mock.calls[1][1]).toHaveProperty('audit.phrase_insights.igos.igos', 42);
  });

  it('attaches the previous stored SIJA run only when one exists (GEM-69-08)', () => {
    const previous = { runAt: '2026-09-01T00:00:00Z', intent: 'comparison' as const, serpIntent: null, ssas: 55, analysed: 4, requested: 5 };
    setPhraseSija('u', 'herbata', sija, previous);
    expect(phraseInsightsFor('u')?.sija?.previous).toEqual({ runAt: '2026-09-01T00:00:00Z', intent: 'comparison', ssas: 55, analysed: 4 });
    setPhraseSija('u', 'herbata', sija);
    expect(phraseInsightsFor('u')?.sija).not.toHaveProperty('previous');
    setPhraseIgos('u', 'herbata', null);
    expect(phraseInsightsFor('u')?.sija).toBeDefined();
  });
});
