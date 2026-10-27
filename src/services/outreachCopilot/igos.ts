import { createProvider } from '@/services/embeddings/registry';
import { usableVector } from '@/services/offPage/sources';
import { buildBaseline } from '@/services/igos/baseline';
import { buildIgosReport, type IgosReport } from '@/services/igos/report';
import type { CompetitorDoc, TargetDoc } from '@/services/igos/types';
import type { IgosSourceCandidate, IgosSourceEvidence } from './source';
import type { OutreachPageInput } from './igosText';
import { belongsToSite, boundedOutreachText, outreachTokens, pageSummary, pageTitle, pageUrl, passages, targetChunks, termCounts } from './igosText';
import { isHttpSourceUrl } from './source';

export interface OutreachCompetitorSource {
  sourceUrl: string;
  rank: number;
  availability: string | null;
  text: string;
  fetchedAt: string | null;
}

export interface OutreachIgosInput {
  site: string;
  targetPages: OutreachPageInput[];
  competitorSources: OutreachCompetitorSource[];
}

export interface OutreachIgosResult {
  report: IgosReport | null;
  sourceCandidates: IgosSourceCandidate[];
}

const empty = (): OutreachIgosResult => ({ report: null, sourceCandidates: [] });
const entities = (text: string, preferred: string[] = []): string[] => {
  const values = preferred.map((value) => value.trim()).filter(Boolean);
  return [...new Set(values.length ? values : outreachTokens(text))].slice(0, 40);
};

const competitorDoc = (source: OutreachCompetitorSource): CompetitorDoc | null => {
  const text = boundedOutreachText(source.text);
  const chunks = passages(text);
  if (source.availability !== 'ok' || !isHttpSourceUrl(source.sourceUrl) || !text || !chunks.length) return null;
  return { url: source.sourceUrl, rank: Number.isFinite(source.rank) ? source.rank : 0, fetchedAt: source.fetchedAt, status: 200,
    entities: entities(text), passages: chunks.map((chunk) => ({ text: chunk, vector: new Float64Array() })), terms: termCounts(text) };
};

const pageCandidate = (input: OutreachPageInput, site: string) => {
  const url = pageUrl(input.source);
  const text = boundedOutreachText(input.text);
  return url && text && belongsToSite(url, site) ? { ...input, url, text } : null;
};

export const buildOutreachIgos = async (input: OutreachIgosInput): Promise<OutreachIgosResult> => {
  const target = input.targetPages.map((page) => pageCandidate(page, input.site)).filter((page): page is OutreachPageInput & { url: string; text: string } => page !== null)
    .sort((left, right) => right.text.length - left.text.length)[0];
  const docs = input.competitorSources.map(competitorDoc).filter((doc): doc is CompetitorDoc => doc !== null);
  if (!target || !docs.length) return empty();
  const chunks = targetChunks(target.source, target.text);
  const textParts = [target.text, ...chunks.map((chunk) => chunk.text), ...docs.flatMap((doc) => doc.passages.map((passage) => passage.text))];
  try {
    const provider = createProvider({ provider: 'local', corpus: textParts });
    const vectors = await provider.embed(textParts);
    if (vectors.length !== textParts.length || vectors.some((vector) => !usableVector(vector))) return empty();
    const targetChunksWithVectors = chunks.map((chunk, index) => ({ ...chunk, vector: vectors[index + 1] }));
    let vectorIndex = chunks.length + 1;
    const embeddedDocs = docs.map((doc) => ({ ...doc, passages: doc.passages.map((passage) => ({ ...passage, vector: vectors[vectorIndex++] })) }));
    const targetDoc: TargetDoc = { url: target.url, entities: entities(target.text, target.source.semantic_terms), chunks: targetChunksWithVectors,
      terms: termCounts(target.text), wordCount: outreachTokens(target.text).length };
    const baseline = buildBaseline(embeddedDocs, input.competitorSources.length);
    const report = buildIgosReport(targetDoc, embeddedDocs, baseline);
    const title = pageTitle(target.source);
    const summary = pageSummary(target.text);
    const novelEntities = report.novelEntities;
    const gainZones = report.zones.filter((z) => z.zone === 'gain').length;
    const hasNovelty = novelEntities.length > 0;
    const reportId = `igos:${target.url}:${report.availableDocs}:${novelEntities.length}:${gainZones}`;
    const evidence: IgosSourceEvidence = {
      reportId,
      sourceUrl: target.url,
      novelEntities,
      gainZones,
      baselineDocs: report.availableDocs,
      baselineProvenance: 'igos',
    };
    const sourceCandidates: IgosSourceCandidate[] = report.igos !== null && report.status !== 'off-topic' && hasNovelty && title && summary
      ? [{ title, url: target.url, summary, provenance: 'igos', evidence }] : [];
    return { report, sourceCandidates };
  } catch {
    return empty();
  }
};
