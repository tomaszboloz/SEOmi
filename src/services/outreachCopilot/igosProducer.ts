import type { CrawledPageSummary } from '@/types';
import { buildBaseline } from '@/services/igos/baseline';
import { buildIgosReport } from '@/services/igos/report';
import type { CompetitorDoc, TargetDoc } from '@/services/igos/types';
import { createLocalHashProvider } from '@/services/embeddings/localProvider';
import type { Vector } from '@/services/embeddings/types';
import { contentStems } from '@/services/embeddings/text';
import { fetchSource } from '@/services/offPage/sourceTransport';
import type { SourceEvidence } from '@/services/offPage/sources';
import { informationGainSource, type InformationGainInput, type InformationGainProvenance } from './informationGain';
import { normalizeDomain } from './gap';

export interface IgosProducerInput { projectId: string; site: string; competitors: string[]; pages: CrawledPageSummary[] }
export interface IgosProducerDeps { fetch: (source: SourceEvidence, signal: AbortSignal) => Promise<SourceEvidence>; embed: (texts: string[]) => Promise<Vector[]>; embedding?: InformationGainProvenance }

const textOf = (page: CrawledPageSummary): string => [
  ...(page.semantic_excerpts ?? []),
  ...(page.rag_sections ?? []).flatMap((section) => section.paragraphs),
].join('\n').slice(0, 20_000).trim();

const entitiesOf = (page: CrawledPageSummary, text: string): string[] => {
  const declared = (page.semantic_terms ?? []).map((term) => term.trim()).filter(Boolean);
  return [...new Set((declared.length ? declared : contentStems(text)).slice(0, 80))];
};

const termsOf = (text: string): Map<string, number> => {
  const terms = new Map<string, number>();
  contentStems(text).forEach((term) => terms.set(term, (terms.get(term) ?? 0) + 1));
  return terms;
};

const ownTarget = (pages: CrawledPageSummary[]): { page: CrawledPageSummary; text: string } | null => pages
  .map((page) => ({ page, text: textOf(page) }))
  .filter(({ page, text }) => Boolean(text) && Boolean(page.final_url || page.url))
  .sort((left, right) => right.text.length - left.text.length)[0] ?? null;

const competitorUrl = (domain: string): string | null => {
  const normalized = normalizeDomain(domain);
  return normalized && normalized.includes('.') ? `https://${normalized}/` : null;
};

const localProvider = createLocalHashProvider();
localProvider.fit([]);
const defaultEmbedding: InformationGainProvenance = { provider: localProvider.id, model: localProvider.model, approximation: 'local-lexical', observedAt: null };
const defaultDeps: IgosProducerDeps = {
  fetch: fetchSource,
  embed: async (texts) => {
    const provider = createLocalHashProvider();
    provider.fit(texts);
    return provider.embed(texts);
  },
  embedding: defaultEmbedding,
};

/** Builds IGOS only from the active project's crawl and live competitor pages. */
export const produceInformationGain = async (
  input: IgosProducerInput, signal: AbortSignal, deps: IgosProducerDeps = defaultDeps,
): Promise<InformationGainInput | null> => {
  const target = ownTarget(input.pages);
  const competitors = [...new Set(input.competitors.map(normalizeDomain).filter(Boolean))].slice(0, 3);
  if (!input.projectId.trim() || !input.site.trim() || !target || competitors.length < 3) return null;
  const sources = competitors.map((domain) => ({ sourceUrl: competitorUrl(domain), authority: null, fetchedAt: null, availability: null, text: '', vector: null }));
  if (sources.some((source) => !source.sourceUrl)) return null;
  const fetched = await Promise.all(sources.map((source) => deps.fetch(source as SourceEvidence, signal)));
  const usable = fetched.filter((source) => source.availability === 'ok' && source.text.trim());
  if (usable.length < 3) return null;
  const corpus = [target.text, ...usable.map((source) => source.text)];
  const vectors = await deps.embed(corpus);
  if (vectors.length !== corpus.length || vectors.some((vector) => !vector.length)) return null;
  const targetDoc: TargetDoc = { url: target.page.final_url || target.page.url, entities: entitiesOf(target.page, target.text), chunks: [{ text: target.text, offset: 0, heading: target.page.title ?? null, vector: vectors[0] }], terms: termsOf(target.text), wordCount: Math.max(1, target.page.word_count) };
  const docs: CompetitorDoc[] = usable.map((source, index) => ({ url: source.sourceUrl, rank: index + 1, fetchedAt: source.fetchedAt, status: 200, entities: [...new Set(contentStems(source.text).slice(0, 80))], passages: [{ text: source.text, vector: vectors[index + 1] }], terms: termsOf(source.text) }));
  const report = buildIgosReport(targetDoc, docs, buildBaseline(docs, 3));
  const source = { title: target.page.title?.trim() ?? '', url: targetDoc.url, summary: target.text.slice(0, 500) };
  const evidence = report.zones.find((zone) => zone.zone === 'gain' && zone.evidence)?.evidence;
  const observedAt = usable.find((item) => item.sourceUrl === evidence?.url)?.fetchedAt ?? null;
  const provenance = { ...(deps.embedding ?? defaultEmbedding), observedAt };
  return { projectId: input.projectId, site: input.site, report, source: informationGainSource({ projectId: input.projectId, site: input.site, report, source, provenance }) ? source : null, provenance };
};
