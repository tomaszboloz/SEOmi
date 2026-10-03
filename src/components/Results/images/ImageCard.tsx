import { useTranslation } from 'react-i18next';
import { Image as ImageIcon, Copy, Check, AlertCircle } from 'lucide-react';
import type { ImageData } from '@/types';
import { ShowOnPageButton } from '../ShowOnPageButton';
import { ImageBadges } from './ImageBadges';
interface Props {img:ImageData;pageUrl:string;copiedUrl:string|null;handleCopy:(url:string)=>void}
export const ImageCard = ({img,pageUrl,copiedUrl,handleCopy}:Props) => {
 const { t } = useTranslation();
 return (<div
  
  className="p-4 hover:bg-slate-800/30 transition flex items-start space-x-4"
>
  <div className="w-16 h-16 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center relative">
    <img
      src={img.src}
      alt={img.alt || ""}
      className="w-full h-full object-cover"
      loading="lazy"
      onError={(e) => {
        (e.target as HTMLElement).style.display = "none";
      }}
    />
    <ImageIcon className="w-6 h-6 text-slate-700 absolute -z-10" />
  </div>

  <div className="flex-1 min-w-0">
    <div className="flex items-center justify-between gap-2 mb-1.5">
      <span className="text-xs font-mono text-slate-200 truncate max-w-xl">
        {img.src}
      </span>
      <button
        onClick={() => handleCopy(img.src)}
        className="text-slate-400 hover:text-white p-1 shrink-0 rounded hover:bg-slate-800 transition"
        title={t("legacyUi.images.copyUrl")}
      >
        {copiedUrl === img.src ? (
          <Check className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
      <ShowOnPageButton
        url={pageUrl}
        selector="img"
        needle={img.src}
        label={t("legacyUi.images.imageLabel", {
          value: img.alt || img.src,
        })}
      />
    </div>
    <div className="mb-2.5">
      {img.has_alt ? (
        <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
          <span className="font-semibold text-emerald-400 font-mono mr-1.5">
            {t("uiUnits.altPrefix")}
          </span>
          {img.alt}
        </p>
      ) : (
        <span className="inline-flex items-center space-x-1.5 text-[11px] font-semibold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-md border border-rose-500/20">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{t("legacyUi.images.missingAltWarning")}</span>
        </span>
      )}
    </div>
    <ImageBadges img={img} />
  </div>
</div>
);
};
