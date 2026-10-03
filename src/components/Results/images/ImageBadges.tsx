import { useTranslation } from 'react-i18next';
import { AlertTriangle, Layers } from 'lucide-react';
import type { ImageData } from '@/types';
import { isModernImage } from './imagePolicy';
export const ImageBadges = ({img}: {img:ImageData}) => {
  const { t } = useTranslation();
  const modern = isModernImage(img.format,img.src);
  const formatLabel = (img.format || img.src.split('.').pop()?.split('?')[0] || 'img').toUpperCase();
  const hasDimensions = Boolean(img.width && img.height);
  return (<div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
      <span
        className={`px-2 py-0.5 rounded font-bold uppercase ${
          modern
            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            : "bg-orange-500/10 text-orange-400 border border-orange-500/20"
        }`}
      >
        {formatLabel}{" "}
        {modern
          ? t("legacyUi.images.modernHint")
          : t("legacyUi.images.legacyHint")}
      </span>
      <span className="text-[10px] text-slate-500">
        {t("legacyUi.images.formatHint")}
      </span>
      {hasDimensions ? (
        <span
          className="bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded border border-slate-700"
          title={
            img.dimensions_source === "intrinsic-data-uri"
              ? t("legacyUi.images.decodedDataUri")
              : img.dimensions_source === "mixed"
                ? t("legacyUi.images.mixedDataUri")
                : t("legacyUi.images.markupDimensions")
          }
        >
          {img.width} × {img.height} {t("uiUnits.pixels")}
          {img.dimensions_source === "intrinsic-data-uri"
            ? ` · ${t("legacyUi.images.intrinsicDataUri")}`
            : img.dimensions_source === "mixed"
              ? ` · ${t("legacyUi.images.mixedEvidence")}`
              : ""}
        </span>
      ) : (
        <span className="inline-flex items-center space-x-1 bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20 font-semibold">
          <AlertTriangle className="w-3 h-3" />
          <span>
            {t("legacyUi.images.missingDimensionsWarning")}
          </span>
        </span>
      )}
      {img.loading ? (
        <span className="bg-slate-800/80 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
          {t("uiUnits.loadingAttribute", { value: img.loading })}
        </span>
      ) : (
        <span className="bg-slate-800/50 text-slate-500 px-2 py-0.5 rounded">
          {t("legacyUi.images.loadingUnspecified")}
        </span>
      )}
      {img.srcset && (
        <span className="inline-flex items-center space-x-1 bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20">
          <Layers className="w-3 h-3" />
          <span>{t("legacyUi.images.responsive")}</span>
        </span>
      )}
    </div>);
};
