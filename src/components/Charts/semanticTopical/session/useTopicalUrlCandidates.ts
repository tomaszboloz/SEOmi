import { useMemo, useState } from 'react';
import type { CrawledPageSummary } from '@/types';
import type { TopicalMapDocument, TopicalNode } from '@/services/topicalMap';
import {
  type TopicalUrlCandidate,
  normalizeTopicalCandidateUrl,
  type TopicalWorkspacePreferences,
} from '../workspaceHelpers';

interface Props {
  pages: CrawledPageSummary[];
  sitemapUrls?: string[];
  document: TopicalMapDocument;
  selectedNode: TopicalNode | null;
  workspacePreferences: TopicalWorkspacePreferences;
}

export const useTopicalUrlCandidates = ({
  pages,
  sitemapUrls = [],
  document,
  selectedNode,
  workspacePreferences,
}: Props) => {
  const [pageSearch, setPageSearch] = useState('');

  const candidateUrlRecords = useMemo(() => {
    const candidates = new Map<string, TopicalUrlCandidate>();
    const add = (
      value: string,
      source: TopicalUrlCandidate['source'],
      title = '',
    ) => {
      const url = normalizeTopicalCandidateUrl(value);
      if (!url) return;
      const current = candidates.get(url);
      const priority: Record<TopicalUrlCandidate['source'], number> = {
        crawl: 0,
        'content-link': 1,
        sitemap: 2,
        saved: 3,
      };
      if (!current || priority[source] < priority[current.source]) {
        candidates.set(url, {
          url,
          title: title || current?.title || '',
          source,
        });
      }
    };

    pages.forEach((page) => {
      const target = page.final_url || page.url;
      add(target, 'crawl', page.title || '');
      add(page.url, 'crawl', page.title || '');
      (page.semantic_links || [])
        .filter((link) => link.is_internal)
        .forEach((link) =>
          add(link.target_url, 'content-link', link.anchor_text || ''),
        );
    });

    sitemapUrls.forEach((url) => add(url, 'sitemap'));
    return [...candidates.values()];
  }, [pages, sitemapUrls]);

  const matchingUrlCandidates = useMemo(() => {
    const query = pageSearch.trim().toLocaleLowerCase();
    const candidates = new Map(
      candidateUrlRecords.map((candidate) => [candidate.url, candidate]),
    );

    selectedNode?.sourceUrls.forEach((url) => {
      const normalized = normalizeTopicalCandidateUrl(url);
      if (normalized && !candidates.has(normalized)) {
        candidates.set(normalized, {
          url: normalized,
          title: '',
          source: 'saved',
        });
      }
    });

    return [...candidates.values()].filter(
      (candidate) =>
        !query ||
        `${candidate.url} ${candidate.title}`
          .toLocaleLowerCase()
          .includes(query),
    );
  }, [candidateUrlRecords, pageSearch, selectedNode]);

  const availableUrlCandidates = matchingUrlCandidates.slice(0, 100);

  const crawledUrls = useMemo(
    () =>
      new Set(
        pages.flatMap((page) =>
          [page.url, page.final_url]
            .map(normalizeTopicalCandidateUrl)
            .filter((url): url is string => Boolean(url)),
        ),
      ),
    [pages],
  );

  const assignedUrlCount = new Set(
    document.nodes
      .flatMap((node) =>
        node.sourceUrls
          .map(normalizeTopicalCandidateUrl)
          .filter((url): url is string => Boolean(url)),
      )
      .filter((url) => crawledUrls.has(url)),
  ).size;

  const matchingTopics = document.nodes.filter(
    (node) =>
      !workspacePreferences.search ||
      `${node.title} ${node.evidenceTerms.join(' ')}`
        .toLocaleLowerCase()
        .includes(workspacePreferences.search.toLocaleLowerCase()),
  );

  return {
    pageSearch,
    setPageSearch,
    candidateUrlRecords,
    matchingUrlCandidates,
    availableUrlCandidates,
    crawledUrls,
    assignedUrlCount,
    matchingTopics,
  };
};
