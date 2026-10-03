import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
export const LinkPagination = ({startIndex,totalCount,currentSafePage,totalPages,setCurrentPage}: {startIndex:number;totalCount:number;currentSafePage:number;totalPages:number;setCurrentPage:Dispatch<SetStateAction<number>>}) => {
 const {t}=useTranslation();
 return (<div className="p-3 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
  <div>
    {t("legacyUi.links.showing", {
      from: startIndex + 1,
      to: Math.min(startIndex + 50, totalCount),
      count: totalCount,
    })}
  </div>

  <div className="flex items-center space-x-2">
    <button
      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
      disabled={currentSafePage === 1}
      className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 text-white transition"
      title={t("legacyUi.links.previousPage")}
    >
      <ChevronLeft className="w-4 h-4" />
    </button>
    <span className="font-mono text-slate-300 px-2">
      {t("legacyUi.links.pageOf", {
        page: currentSafePage,
        pages: totalPages,
      })}
    </span>
    <button
      onClick={() =>
        setCurrentPage((p) => Math.min(totalPages, p + 1))
      }
      disabled={currentSafePage === totalPages}
      className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 text-white transition"
      title={t("legacyUi.links.nextPage")}
    >
      <ChevronRight className="w-4 h-4" />
    </button>
  </div>
</div>);
};
