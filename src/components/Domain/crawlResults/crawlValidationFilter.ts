import type { CrawledPageSummary } from '@/types';

type Finding = NonNullable<CrawledPageSummary['html_validation_findings']>[number];

export interface ValidationPageMatch {
  page: CrawledPageSummary;
  findings: Finding[];
  pageMatches: boolean;
}

/** Pages with validation evidence, filtered by a free-text query and finding severity. */
export const filterValidationPages = (pages: CrawledPageSummary[], query: string, severity: string) => {
  const checkedPages = pages.filter(
    (page) =>
      page.html_validation_findings !== undefined ||
      page.detected_charset !== undefined,
  );
  const normalizedValidationQuery = query
    .trim()
    .toLocaleLowerCase();
  const matches = checkedPages
    .map((page) => {
      const pageMatches = normalizedValidationQuery
        ? [page.url, page.charset, page.detected_charset]
            .filter(Boolean)
            .some((value) =>
              String(value)
                .toLocaleLowerCase()
                .includes(normalizedValidationQuery),
            )
        : true;
      const findings = (page.html_validation_findings || []).filter(
        (finding) => {
          if (
            severity !== "all" &&
            finding.severity !== severity
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
              String(value)
                .toLocaleLowerCase()
                .includes(normalizedValidationQuery),
            );
        },
      );
      return { page, findings, pageMatches };
    })
    .filter(
      ({ findings, pageMatches }) =>
        (!normalizedValidationQuery && severity === "all") ||
        // With an empty query every page "matches"; only a real query match may keep
        // a page that has no finding of the selected severity.
        (Boolean(normalizedValidationQuery) && pageMatches) ||
        findings.length > 0,
    );
  return { checkedPages, validationPages: matches };
};
