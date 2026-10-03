import type { CustomSearchConfigItem } from './customSearchTypes';

interface CustomSearchConfigCardsProps {
  searches: CustomSearchConfigItem[];
  t: (key: string, params?: Record<string, unknown>) => string;
}

export const CustomSearchConfigCards = ({
  searches,
  t,
}: CustomSearchConfigCardsProps) => (
  <div className="grid gap-2 md:grid-cols-2">
    {searches.map((search) => (
      <div
        key={search.id}
        className="rounded-lg border border-slate-800 bg-slate-950/40 p-3"
      >
        <p className="text-xs font-semibold text-slate-200">
          {search.name} · {search.resultType}
          {search.resultType === "attribute"
            ? ` (${search.attribute || t("crawl.customSearch.attribute")})`
            : ""}
        </p>
        <p className="mt-1 break-all font-mono text-[11px] text-emerald-200">
          {search.selectorType.toUpperCase()}: {search.query}
        </p>
      </div>
    ))}
  </div>
);
