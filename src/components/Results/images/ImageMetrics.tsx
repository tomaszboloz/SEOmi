import { useTranslation } from 'react-i18next';
import { Image as ImageIcon, AlertCircle, AlertTriangle, Sparkles } from 'lucide-react';
export const ImageMetrics = ({total, missingAltCount, missingDimCount, modernCount}: {total:number;missingAltCount:number;missingDimCount:number;modernCount:number}) => {
  const { t } = useTranslation();
  return (<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 shrink-0">
            <ImageIcon className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
              {t("images.imagesFound")}
            </span>
            <span className="text-lg font-bold text-white font-mono">
              {total}
            </span>
          </div>
        </div>

        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
              {t("images.missingAlt")}
            </span>
            <span className="text-lg font-bold text-rose-400 font-mono">
              {missingAltCount}
            </span>
          </div>
        </div>

        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
              {t("legacyUi.images.clsRisk")}
            </span>
            <span className="text-lg font-bold text-amber-400 font-mono">
              {missingDimCount}
            </span>
          </div>
        </div>

        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 shrink-0">
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
              {t("legacyUi.images.modernHints")}
            </span>
            <span
              className="text-lg font-bold text-indigo-400 font-mono"
              title={t("legacyUi.images.modernHintTitle")}
            >
              {modernCount}/{total}
            </span>
          </div>
        </div>
      </div>);
};
