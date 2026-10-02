import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Monitor, Smartphone, Link2, ListTree } from 'lucide-react';
import { PageAuditData } from '@/types';
import { highlightQuery } from './socialHelpers';

interface SocialGoogleSerpProps {
  serpMode: 'desktop' | 'mobile';
  setSerpMode: (mode: 'desktop' | 'mobile') => void;
  audit: PageAuditData;
  siteName: string;
  displayUrl: string;
  visibleTitle: string;
  visibleDescription: string;
  liveQuery: string;
  liveTitle: string;
  liveDesc: string;
  estimatedPixelWidth: number;
  sitelinkCandidates: { url: string; label: string; displayUrl: string }[];
  richResultPreview: { title: string; type: string; fields: { label: string; value: string }[] } | null;
}

export const SocialGoogleSerp: React.FC<SocialGoogleSerpProps> = ({
  serpMode,
  setSerpMode,
  audit,
  siteName,
  displayUrl,
  visibleTitle,
  visibleDescription,
  liveQuery,
  liveTitle,
  liveDesc,
  estimatedPixelWidth,
  sitelinkCandidates,
  richResultPreview,
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Globe className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">{t('social.serpPreview')}</h3>
        </div>
        <div className="flex items-center space-x-1 bg-slate-800 p-0.5 rounded-lg border border-slate-700/60">
          <button
            onClick={() => setSerpMode('desktop')}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition flex items-center space-x-1 ${
              serpMode === 'desktop'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>{t('social.desktop')}</span>
          </button>
          <button
            onClick={() => setSerpMode('mobile')}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition flex items-center space-x-1 ${
              serpMode === 'mobile'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>{t('social.mobile')}</span>
          </button>
        </div>
      </div>

      <p className="mb-3 text-[11px] leading-5 text-slate-500">{t('legacyUi.social.visualApprox')}</p>

      <div
        className={`force-dark bg-[#202124] text-[#bdc1c6] p-4 rounded-xl border border-slate-800 font-sans ${
          serpMode === 'mobile' ? 'max-w-[390px] mx-auto shadow-2xl' : 'max-w-[650px]'
        }`}
      >
        <div className="flex items-center space-x-2 mb-1 text-xs text-[#dadce0]">
          <div className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
            {audit.technical.favicon ? (
              <img src={audit.technical.favicon} alt="" className="w-3.5 h-3.5" />
            ) : (
              <Globe className="w-2.5 h-2.5 text-slate-400" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-[13px] text-[#dadce0] font-medium leading-none">{siteName}</span>
            <span className="text-[11px] text-[#bdc1c6] truncate max-w-[320px]">{displayUrl}</span>
          </div>
        </div>

        <h4 className="text-[20px] font-normal text-[#8ab4f8] hover:underline cursor-pointer leading-tight mb-1.5 truncate">
          {visibleTitle}
        </h4>

        <p aria-label={t('legacyUi.social.googleSnippetAria')} className="text-[13px] text-[#bdc1c6] leading-relaxed line-clamp-2">
          {highlightQuery(visibleDescription, liveQuery)}
        </p>

        <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>{t('legacyUi.social.titleLength', { count: liveTitle.length, pixels: estimatedPixelWidth })}</span>
          <span>{t('legacyUi.social.snippetLength', { count: liveDesc.length })}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2" aria-label={t('legacyUi.social.enhancedCandidates')}>
        <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-4" aria-label={t('legacyUi.social.localSitelinks')}>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-100"><Link2 className="h-4 w-4 text-emerald-300" />{t('social.sitelinkCandidates')}</div>
          <p className="mb-3 text-[11px] leading-5 text-slate-500">{t('social.sitelinkEvidence')}</p>
          {sitelinkCandidates.length ? <div className="grid gap-2 sm:grid-cols-2">{sitelinkCandidates.map((candidate) => <div key={candidate.url} className="min-w-0 rounded-lg border border-slate-800 bg-slate-900/70 p-2.5"><p className="truncate text-xs font-medium text-[#8ab4f8]">{candidate.label}</p><p className="truncate text-[10px] text-slate-500">{candidate.displayUrl}</p></div>)}</div> : <p className="text-xs text-slate-500">{t('social.sitelinkEmpty')}</p>}
        </section>
        <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-4" aria-label={t('legacyUi.social.localRichResult')}>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-100"><ListTree className="h-4 w-4 text-sky-300" />{t('social.richResultCandidate')}</div>
          <p className="mb-3 text-[11px] leading-5 text-slate-500">{t('social.richResultEvidence')}</p>
          {richResultPreview ? <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3"><div className="mb-2 flex items-center justify-between gap-2"><span className="text-xs font-medium text-slate-200">{richResultPreview.title}</span><span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-300">{richResultPreview.type}</span></div><dl className="space-y-1.5">{richResultPreview.fields.map((field, index) => <div key={`${field.label}-${index}`} className="grid grid-cols-[auto_1fr] gap-2 text-[11px]"><dt className="text-slate-500">{field.label}</dt><dd className="truncate text-slate-200">{field.value}</dd></div>)}</dl></div> : <p className="text-xs text-slate-500">{t('social.richResultEmpty')}</p>}
        </section>
      </div>
    </div>
  );
};
