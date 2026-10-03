import { useTranslation } from 'react-i18next';
import { ShieldAlert, AlertTriangle, Loader2, Wifi, Copy, Check } from 'lucide-react';
import type { LinkData } from '@/types';
import { ShowOnPageButton } from '../ShowOnPageButton';
import { unsafeBlankLink, insecureLink } from './linkPolicy';
import type { LinkVerification } from './useLinkVerification';
interface Props {link:LinkData;pageUrl:string;isPageHttps:boolean;verified?:LinkVerification;copiedUrl:string|null;handleCopy:(href:string)=>void;handleVerifySingleLink:(href:string)=>void}
export const LinkCard = ({link,pageUrl,isPageHttps,verified,copiedUrl,handleCopy,handleVerifySingleLink}:Props) => {
 const {t}=useTranslation();
 const isUnsafeBlank=unsafeBlankLink(link);
 const isInsecure=insecureLink(link,isPageHttps);
 return (<div
  
  className="p-3.5 hover:bg-slate-800/30 transition flex items-start space-x-3 text-xs"
>
  <div className="pt-0.5 shrink-0">
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
        link.is_internal
          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
          : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
      }`}
    >
      {link.is_internal
        ? t("legacyUi.links.internalLabel")
        : t("legacyUi.links.externalLabel")}
    </span>
  </div>

  <div className="flex-1 min-w-0">
    <div className="flex items-center space-x-2">
      <span className="font-medium text-white truncate max-w-sm">
        {link.text || (
          <span className="text-slate-500 italic">
            {t("legacyUi.links.noAnchor")}
          </span>
        )}
      </span>

      {link.rel && (
        <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
          {t("uiUnits.relAttribute", { value: link.rel })}
        </span>
      )}

      {link.target && (
        <span className="text-[10px] text-slate-400 font-mono bg-slate-800/60 px-1.5 py-0.5 rounded">
          {t("uiUnits.targetAttribute", { value: link.target })}
        </span>
      )}
    </div>

    <div className="font-mono text-slate-400 text-[11px] truncate mt-0.5">
      {link.href}
    </div>
    <div className="flex flex-wrap gap-2 mt-1.5">
      {isUnsafeBlank && (
        <div className="inline-flex items-center space-x-1 text-rose-400 text-[10px] font-medium bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
          <ShieldAlert className="w-3 h-3 shrink-0" />
          <span>{t("legacyUi.links.tabnabbing")}</span>
        </div>
      )}

      {isInsecure && (
        <div className="inline-flex items-center space-x-1 text-amber-400 text-[10px] font-medium bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span>{t("legacyUi.links.mixedContent")}</span>
        </div>
      )}
    </div>
  </div>
  <div className="flex items-center space-x-2 shrink-0">
    {verified?.checking ? (
      <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-slate-800 text-slate-300 flex items-center space-x-1">
        <Loader2 className="w-2.5 h-2.5 animate-spin text-emerald-400" />
        <span>{t("legacyUi.links.pinging")}</span>
      </span>
    ) : verified ? (
      <span
        className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
          verified.error
            ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
            : verified.isBroken
            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
        }`}
      >
        {verified.error || (verified.status
          ? t("crawl.ui.httpStatus", { status: verified.status })
          : t("legacyUi.links.offline"))}
      </span>
    ) : (
      <button
        onClick={() => handleVerifySingleLink(link.href)}
        className="text-[10px] text-slate-400 hover:text-emerald-400 bg-slate-800/80 hover:bg-slate-800 px-2 py-0.5 rounded border border-slate-700 transition flex items-center space-x-1"
        title={t("legacyUi.links.pingTitle")}
      >
        <Wifi className="w-2.5 h-2.5" />
        <span>{t("legacyUi.links.ping")}</span>
      </button>
    )}

    <ShowOnPageButton
      url={pageUrl}
      selector="a[href]"
      needle={link.href}
      label={`${t("legacyUi.links.internalLabel")} ${link.text || link.href}`}
    />

    <button
      onClick={() => handleCopy(link.href)}
      className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
      title={t("legacyUi.links.copyUrl")}
    >
      {copiedUrl === link.href ? (
        <Check className="w-3.5 h-3.5 text-emerald-400" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  </div>
</div>);
};
