import type { IgosReport } from '@/services/igos/report';
import type { ChunkZone } from '@/services/igos/types';
import type { SijaHistoryEntry } from '@/services/sija/history';
import type { PhraseIntentReport } from '@/services/sija/phraseIntent';

/** IGOS figures for the PDF (#68 GEM-68-06): numbers only, never competitor text. */
export interface PhraseIgosSummary {
  igos: number | null;
  status: IgosReport['status'];
  components: IgosReport['components'];
  coverage: number | null;
  availableDocs: number;
  requestedDocs: number;
  zones: Record<ChunkZone, number>;
  novelEntities: number;
  missingBasics: number;
  provider: string | null;
  model: string | null;
  runAt: string | null;
  limitations: string[];
}

/** SIJA figures for the PDF (#69 GEM-69-08). */
export interface PhraseSijaSummary {
  intent: string | null;
  serpIntent: string | null;
  match: PhraseIntentReport['intentMatch'];
  ssas: number | null;
  ssasStatus: PhraseIntentReport['ssas']['status'];
  analysed: number;
  requested: number;
  funnel: PhraseIntentReport['funnel'];
  gaps: Array<{ format: string; topPages: number; analysed: number }>;
  /** Previous stored run of the same phrase (GEM-69-08); absent on the first run. */
  previous?: { runAt: string; intent: string | null; ssas: number | null; analysed: number };
}

export interface PhraseInsights { phrase: string; igos?: PhraseIgosSummary; sija?: PhraseSijaSummary }

const store = new Map<string, PhraseInsights>();
const keyOf = (url: string): string => url.trim();

export const igosSummary = (report: IgosReport): PhraseIgosSummary => {
  const zones: Record<ChunkZone, number> = { echo: 0, gain: 0, drift: 0, neutral: 0 };
  report.zones.forEach((zone) => { zones[zone.zone] += 1; });
  return {
    igos: report.igos, status: report.status, components: report.components ? { ...report.components } : null, coverage: report.coverage,
    availableDocs: report.availableDocs, requestedDocs: report.requestedDocs, zones, novelEntities: report.novelEntities.length, missingBasics: report.missingBasics?.length ?? 0,
    provider: report.provenance?.provider ?? null, model: report.provenance?.model ?? null, runAt: report.provenance?.runAt ?? null,
    limitations: [...report.limitations],
  };
};

export const sijaSummary = (report: PhraseIntentReport, previous?: SijaHistoryEntry): PhraseSijaSummary => ({
  intent: report.page.primary, serpIntent: report.serpIntent.intent, match: report.intentMatch, ssas: report.ssas.score, ssasStatus: report.ssas.status,
  analysed: report.analysed, requested: report.requested, funnel: { ...report.funnel }, gaps: report.gaps.map((gap) => ({ ...gap })),
  ...(previous ? { previous: { runAt: previous.runAt, intent: previous.intent, ssas: previous.ssas, analysed: previous.analysed } } : {}),
});

/** Latest phrase results of an audited URL; another phrase replaces the entry, null clears that part. */
const update = (url: string, phrase: string, patch: Partial<Omit<PhraseInsights, 'phrase'>>, drop: 'igos' | 'sija'): void => {
  if (!url.trim() || !phrase.trim()) return;
  const current = store.get(keyOf(url));
  const next: PhraseInsights = { ...(current?.phrase === phrase ? current : {}), phrase, ...patch };
  if (!(drop in patch)) delete next[drop];
  if (next.igos || next.sija) store.set(keyOf(url), next); else store.delete(keyOf(url));
};

export const setPhraseIgos = (url: string, phrase: string, report: IgosReport | null): void =>
  update(url, phrase, report ? { igos: igosSummary(report) } : {}, 'igos');

export const setPhraseSija = (url: string, phrase: string, report: PhraseIntentReport | null, previous?: SijaHistoryEntry): void =>
  update(url, phrase, report ? { sija: sijaSummary(report, previous) } : {}, 'sija');

export const phraseInsightsFor = (url: string): PhraseInsights | null => store.get(keyOf(url)) ?? null;

export const clearPhraseInsights = (): void => store.clear();
