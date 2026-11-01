import { useEffect, useState } from 'react';
import { loadEmbeddingSession } from '@/components/Keywords/embeddingClustering/useEmbeddingClustering';
import { LOCAL_OLLAMA_URL } from '@/services/embeddingClustering';
import { createProvider, type ProviderSettings } from '@/services/embeddings/registry';
import type { EmbeddingProvider } from '@/services/embeddings/types';
import { buildEmbeddingSet } from '@/services/semanticSource/buildSet';
import type { EmbeddingSet } from '@/services/semanticSource/types';
import { normalizeUrl } from '@/services/siteFocus/pageType';
import type { CrawledPageSummary } from '@/types';

export const SPRS_EMBEDDING_PROFILE = { maxPages: 300, timeoutMs: 30_000, maxChars: 2_000 } as const;

const pageText = (page: CrawledPageSummary): string =>
  [page.title ?? '', ...(page.semantic_terms ?? []).slice(0, 40), ...(page.semantic_excerpts ?? []).slice(0, 3)].join(' ').slice(0, SPRS_EMBEDDING_PROFILE.maxChars);

/**
 * Optional semantic page vectors for SPRS simPage (#71, #86). Opt-in: only when the project's embedding
 * settings choose a semantic provider (anything but `local`). Any failure leaves `undefined`, so SPRS
 * keeps the deterministic lexical similarity.
 */
export const useSprsEmbeddings = (
  projectId: string | null | undefined, pages: CrawledPageSummary[],
  factory: (settings: ProviderSettings) => EmbeddingProvider = createProvider,
): EmbeddingSet | undefined => {
  const [set, setSet] = useState<EmbeddingSet | undefined>();
  useEffect(() => {
    setSet(undefined);
    const { provider, ollamaModel } = loadEmbeddingSession(projectId ?? null).settings;
    if (!projectId || provider === 'local' || !pages.length) return undefined;
    const controller = new AbortController();
    const texts = new Map(pages.map((page) => [normalizeUrl(page.final_url || page.url), pageText(page)] as const));
    void buildEmbeddingSet(factory({ provider, ollamaModel: ollamaModel.trim() || undefined, ollamaUrl: LOCAL_OLLAMA_URL }), {
      pages: texts, maxEntries: SPRS_EMBEDDING_PROFILE.maxPages, timeoutMs: SPRS_EMBEDDING_PROFILE.timeoutMs, signal: controller.signal,
    }).then((result) => setSet(result.set ?? undefined)).catch(() => undefined); // an aborted build rejects, so a stale set is never stored
    return () => controller.abort();
  }, [projectId, pages, factory]);
  return set;
};
