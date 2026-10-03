import { downloadCrawlCustomSearchCsv } from "@/services/export";
import { Empty } from './CrawlViewPrimitives';
import { buildCustomSearchRows } from './customSearch/customSearchRows';
import { CustomSearchHeaderCard } from './customSearch/CustomSearchHeaderCard';
import { CustomSearchConfigCards } from './customSearch/CustomSearchConfigCards';
import { CustomSearchTable } from './customSearch/CustomSearchTable';
import type { useCrawlResultsSession } from './useCrawlResultsSession';

type Session = ReturnType<typeof useCrawlResultsSession>;

export const CrawlCustomSearchTab = ({ session }: { session: Session }) => {
  const { currentRun, customSearchDisplayLimit, result, setCustomSearchDisplayLimit, t } = session;
  const searches = currentRun?.config.customSearches || [];

  if (searches.length === 0) {
    return <Empty>{t("crawl.customSearch.notConfigured")}</Empty>;
  }

  const rows = buildCustomSearchRows(result.pages, searches, t);

  return (
    <div className="space-y-4">
      <CustomSearchHeaderCard
        searchesCount={searches.length}
        currentRun={currentRun}
        onExport={() => currentRun && downloadCrawlCustomSearchCsv(currentRun)}
        t={t}
      />
      <CustomSearchConfigCards searches={searches} t={t} />
      {rows.length === 0 ? (
        <Empty>{t("crawl.customSearch.noPages")}</Empty>
      ) : (
        <CustomSearchTable
          rows={rows}
          displayLimit={customSearchDisplayLimit}
          onLoadMore={() => setCustomSearchDisplayLimit((limit) => limit + 200)}
          t={t}
        />
      )}
    </div>
  );
};
