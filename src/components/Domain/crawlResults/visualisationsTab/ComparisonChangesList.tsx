import type { CrawlDiff } from "@/services/crawlDiff";

interface ComparisonChangesListProps {
  comparison: CrawlDiff;
  t: (key: string, params?: Record<string, unknown>) => string;
}

export const ComparisonChangesList = ({
  comparison,
  t,
}: ComparisonChangesListProps) => {
  const allChanges = [
    ...comparison.added,
    ...comparison.removed,
    ...comparison.changed,
  ];

  return (
    <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs sm:col-span-3">
      {allChanges.length === 0 ? (
        <p className="text-slate-500">{t("crawlDeepUi.noComparisonChanges")}</p>
      ) : (
        allChanges.map((change) => (
          <p
            key={`${change.kind}-${change.url}`}
            className="truncate py-1 text-slate-300"
          >
            {change.kind} · {change.url}
            {change.matchedUrl && change.matchedUrl !== change.url
              ? ` ↔ ${change.matchedUrl}`
              : ""}
            {change.fields.length ? ` (${change.fields.join(", ")})` : ""}
          </p>
        ))
      )}
    </div>
  );
};
