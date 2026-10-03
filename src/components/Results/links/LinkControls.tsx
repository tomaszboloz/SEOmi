import { useTranslation } from 'react-i18next';
import { Search, CheckCircle2, Loader2, Download } from 'lucide-react';
import type { LinksAnalysis } from '@/types';
import type { LinkFilter } from './linkPolicy';
interface Props {links:LinksAnalysis;securityIssuesCount:number;search:string;setSearch:(value:string)=>void;setCurrentPage:(page:number)=>void;filterType:LinkFilter;setFilterType:(filter:LinkFilter)=>void;isVerifyingBatch:boolean;pageCount:number;handleVerifyBatch:()=>void;exportCsv:()=>void}
export const LinkControls = ({links,securityIssuesCount,search,setSearch,setCurrentPage,filterType,setFilterType,isVerifyingBatch,pageCount,handleVerifyBatch,exportCsv}:Props) => {
 const {t}=useTranslation();
 return (<div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={t("legacyUi.links.searchPlaceholder")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-9 pl-9 pr-3 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end overflow-x-auto">
          <div className="flex items-center space-x-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => {
                setFilterType("all");
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                filterType === "all"
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {t("legacyUi.links.all", { count: links.total_links })}
            </button>
            <button
              onClick={() => {
                setFilterType("internal");
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                filterType === "internal"
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {t("legacyUi.links.internal", { count: links.internal_links })}
            </button>
            <button
              onClick={() => {
                setFilterType("external");
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                filterType === "external"
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {t("legacyUi.links.external", { count: links.external_links })}
            </button>
            <button
              onClick={() => {
                setFilterType("security");
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                filterType === "security"
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {t("legacyUi.links.risks", { count: securityIssuesCount })}
            </button>
            <button
              onClick={() => {
                setFilterType("nofollow");
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                filterType === "nofollow"
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {t("legacyUi.links.nofollow", { count: links.nofollow_links })}
            </button>
          </div>

          <button
            onClick={handleVerifyBatch}
            disabled={isVerifyingBatch || pageCount === 0}
            className="h-9 px-3 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg transition border border-slate-700 flex items-center space-x-1.5 disabled:opacity-50 shrink-0"
          >
            {isVerifyingBatch ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span className="hidden sm:inline">
              {t("legacyUi.links.verifyPage", { count: pageCount })}
            </span>
          </button>
          <button
            type="button"
            onClick={() => exportCsv()}
            className="h-9 shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-3 text-xs font-medium text-slate-200 transition hover:bg-slate-700 hover:text-white"
            title={t("legacyUi.links.exportTitle")}
          >
            <span className="inline-flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5 text-emerald-400" />
              {t("legacyUi.url.csv")}
            </span>
          </button>
        </div>
      </div>);
};
