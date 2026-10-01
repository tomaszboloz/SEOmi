import { useTranslation } from 'react-i18next';
import type { LinksAnalysis } from '@/types';
export const LinkMetrics = ({links,securityIssuesCount}: {links:LinksAnalysis;securityIssuesCount:number}) => {
 const {t}=useTranslation();
 return (<div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block">
            {t("links.totalLinks")}
          </span>
          <span className="text-xl font-bold text-white font-mono">
            {links.total_links}
          </span>
        </div>

        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block">
            {t("links.internal")}
          </span>
          <span className="text-xl font-bold text-emerald-400 font-mono">
            {links.internal_links}
          </span>
        </div>

        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block">
            {t("links.external")}
          </span>
          <span className="text-xl font-bold text-blue-400 font-mono">
            {links.external_links}
          </span>
        </div>

        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block">
            {t("links.nofollow")}
          </span>
          <span className="text-xl font-bold text-amber-400 font-mono">
            {links.nofollow_links}
          </span>
        </div>

        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block">
            {t("legacyUi.links.securityRisks")}
          </span>
          <span
            className={`text-xl font-bold font-mono ${
              securityIssuesCount > 0 ? "text-rose-400" : "text-slate-400"
            }`}
          >
            {securityIssuesCount}
          </span>
        </div>
      </div>
);
};
