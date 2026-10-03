import { useTranslation } from 'react-i18next';
import { Search, Download } from 'lucide-react';
import type { ImageFilter } from './imagePolicy';
interface Props {total:number;missingAltCount:number;missingDimCount:number;legacyCount:number;modernCount:number;filter:ImageFilter;setFilter:(filter:ImageFilter)=>void;search:string;setSearch:(search:string)=>void;exportCsv:()=>void}
export const ImageControls = ({total,missingAltCount,missingDimCount,legacyCount,modernCount,filter,setFilter,search,setSearch,exportCsv}:Props) => {
  const { t } = useTranslation();
  return (<div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={t("legacyUi.images.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto text-xs">
          <div className="flex items-center space-x-1.5 p-1 bg-slate-900/80 rounded-xl border border-slate-800">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
                filter === "all"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {t("legacyUi.images.all", { count: total })}
            </button>
            <button
              onClick={() => setFilter("missing-alt")}
              className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
                filter === "missing-alt"
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {t("legacyUi.images.missingAlt", { count: missingAltCount })}
            </button>
            <button
              onClick={() => setFilter("missing-dim")}
              className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
                filter === "missing-dim"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {t("legacyUi.images.missingDimensions", {
                count: missingDimCount,
              })}
            </button>
            <button
              onClick={() => setFilter("legacy")}
              className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
                filter === "legacy"
                  ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {t("legacyUi.images.legacy", { count: legacyCount })}
            </button>
            <button
              onClick={() => setFilter("modern")}
              className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
                filter === "modern"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {t("legacyUi.images.modern", { count: modernCount })}
            </button>
          </div>
          <button
            type="button"
            onClick={() => exportCsv()}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 font-medium text-slate-200 transition hover:bg-slate-700 hover:text-white"
            title={t("legacyUi.images.exportTitle")}
          >
            <Download className="h-3.5 w-3.5 text-emerald-400" />
            {t("legacyUi.url.csv")}
          </button>
        </div>
      </div>);
};
