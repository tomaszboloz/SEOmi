import type { CrawledPageSummary } from '@/types';
import type { CustomSearchConfigItem, CustomSearchRow } from './customSearchTypes';

export function buildCustomSearchRows(
  pages: CrawledPageSummary[],
  searches: CustomSearchConfigItem[],
  t: (key: string, params?: Record<string, unknown>) => string,
): CustomSearchRow[] {
  return pages.flatMap((page) =>
    searches.flatMap((search) => {
      const extraction = page.custom_search_results?.find(
        (item: { id: string }) => item.id === search.id,
      );
      if (!extraction) {
        return [
          {
            key: `${page.url}-${search.id}-missing`,
            url: page.url,
            search,
            value: t("crawl.customSearch.noResult"),
            match: "",
            status: t("crawl.customSearch.oldRun"),
          },
        ];
      }
      if (extraction.error) {
        return [
          {
            key: `${page.url}-${search.id}-error`,
            url: page.url,
            search,
            value: extraction.error,
            match: "",
            status: t("crawl.customSearch.selectorError"),
          },
        ];
      }
      if (extraction.values.length === 0) {
        return [
          {
            key: `${page.url}-${search.id}-empty`,
            url: page.url,
            search,
            value: "—",
            match: "",
            status: t("crawl.customSearch.noMatch"),
          },
        ];
      }
      return extraction.values.map((value: string, index: number) => ({
        key: `${page.url}-${search.id}-${index}`,
        url: page.url,
        search,
        value,
        match: String(index + 1),
        status: extraction.truncated
          ? t("crawl.customSearch.bounded")
          : t("crawl.customSearch.ok"),
      }));
    }),
  );
}
