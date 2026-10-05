import { useMemo } from 'react';
import type { CrawledHtmlValidationFinding, CrawledPageSummary } from '@/types';
import type { FilteredValidationPage } from './validationTabTypes';

export function useValidationFilter(
  pages: CrawledPageSummary[],
  validationQuery: string,
  validationSeverity: 'all' | 'Error' | 'Warning',
) {
  return useMemo(() => {
    const checkedPages = pages.filter(
      (page) =>
        page.html_validation_findings !== undefined ||
        page.detected_charset !== undefined,
    );
    const normalizedValidationQuery = validationQuery.trim().toLocaleLowerCase();
    const validationPages: FilteredValidationPage[] = checkedPages
      .map((page) => {
        const pageMatches = normalizedValidationQuery
          ? [page.url, page.charset, page.detected_charset]
              .filter(Boolean)
              .some((value) =>
                String(value).toLocaleLowerCase().includes(normalizedValidationQuery),
              )
          : true;
        const findings = (page.html_validation_findings || []).filter(
          (finding: CrawledHtmlValidationFinding) => {
            if (
              validationSeverity !== 'all' &&
              finding.severity !== validationSeverity
            ) {
              return false;
            }
            if (!normalizedValidationQuery || pageMatches) return true;
            return [
              finding.code,
              finding.message,
              finding.element,
              finding.attribute,
              finding.value,
              finding.source_excerpt,
            ]
              .filter(Boolean)
              .some((value) =>
                String(value).toLocaleLowerCase().includes(normalizedValidationQuery),
              );
          },
        );
        return { page, findings, pageMatches };
      })
      .filter(
        ({ findings, pageMatches }) =>
          (!normalizedValidationQuery && validationSeverity === 'all') ||
          // With an empty query every page "matches"; only a real query match
          // may keep a page that has no finding of the selected severity.
          (Boolean(normalizedValidationQuery) && pageMatches) ||
          findings.length > 0,
      );

    const validationFindingCount = validationPages.reduce(
      (count, item) => count + item.findings.length,
      0,
    );

    return { checkedPages, validationPages, validationFindingCount };
  }, [pages, validationQuery, validationSeverity]);
}
