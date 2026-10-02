import type { CrawledPageSummary, CustomSearchDefinition } from '@/types';

export interface CustomSearchRow {
  key: string;
  url: string;
  search: CustomSearchDefinition;
  value: string;
  match: string;
  status: string;
}

export const customSearchRows = (
  pages: CrawledPageSummary[],
  searches: CustomSearchDefinition[],
  t: (key: string) => string,
): CustomSearchRow[] =>
  pages.flatMap((page) =>
    searches.flatMap((search) => {
      const extraction = page.custom_search_results?.find(
        (item) => item.id === search.id,
      );
      if (!extraction)
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
      if (extraction.error)
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
      if (extraction.values.length === 0)
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
      return extraction.values.map((value, index) => ({
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
