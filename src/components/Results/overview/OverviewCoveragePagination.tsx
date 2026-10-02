import React from "react";
import { useTranslation } from "react-i18next";

interface OverviewCoveragePaginationProps {
  totalResults: number;
  safePage: number;
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
}

export const OverviewCoveragePagination: React.FC<
  OverviewCoveragePaginationProps
> = ({ totalResults, safePage, pageCount, onPrev, onNext }) => {
  const { t } = useTranslation();

  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-slate-500">
      <span>
        {t("legacyUi.overview.resultsPage", {
          count: totalResults,
          page: safePage + 1,
          pages: pageCount,
        })}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={safePage === 0}
          onClick={onPrev}
          className="rounded-md border border-slate-700 px-2.5 py-1 text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("legacyUi.overview.previous")}
        </button>
        <button
          type="button"
          disabled={safePage >= pageCount - 1}
          onClick={onNext}
          className="rounded-md border border-slate-700 px-2.5 py-1 text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("legacyUi.overview.next")}
        </button>
      </div>
    </div>
  );
};
