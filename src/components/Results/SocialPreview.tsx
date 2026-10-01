import { readJsonRecord } from '@/services/storageContracts';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Globe,
  Monitor,
  Smartphone,
  Share2,
  Image as ImageIcon,
  Sliders,
  RotateCcw,
  Sparkles,
  MessageSquare,
  Hash,
  Link2,
  ListTree,
} from 'lucide-react';
import { PageAuditData } from '@/types';
import { useUIStore } from '@/stores/uiStore';
import { useAuditStore } from '@/stores/auditStore';
import { getSocialProblems } from '@/services/auditProblems';
import { deriveSerpRichResult, deriveSerpSitelinks, formatSerpDisplayUrl, measureSerpText, SERP_VIEWPORTS, truncateSerpSnippet, truncateSerpText } from '@/services/serpPreview';
import { useProjectStore } from '@/stores/projectStore';
import { ProblemsOnlyNotice } from './ProblemsOnlyNotice';
import { writeJsonStorage } from '@/services/storage';

interface SocialPreviewProps {
  audit: PageAuditData;
}

type PlatformTab = 'all' | 'google' | 'facebook' | 'twitter' | 'discord' | 'linkedin' | 'slack' | 'chat';

interface SerpDraft {
  title: string;
  description: string;
  image: string;
  query: string;
}

const serpDraftKey = (projectId: string | null, url: string) => projectId
  ? `seomi_serp_preview_${projectId}_${encodeURIComponent(url)}`
  : null;

const readSerpDraft = (key: string | null, fallback: SerpDraft): SerpDraft => {
  if (!key) return fallback;
  try {
    const stored = readJsonRecord(key);
    if (!stored || typeof stored !== 'object') return fallback;
    return {
      title: typeof stored.title === 'string' ? stored.title : fallback.title,
      description: typeof stored.description === 'string' ? stored.description : fallback.description,
      image: typeof stored.image === 'string' ? stored.image : fallback.image,
      query: typeof stored.query === 'string' ? stored.query : fallback.query,
    };
  } catch {
    return fallback;
  }
};

const highlightQuery = (text: string, query: string): React.ReactNode => {
  const terms = query.trim().split(/\s+/u).filter(Boolean);
  if (!terms.length) return text;
  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'));
  const matcher = new RegExp(`(${escaped.join('|')})`, 'giu');
  return text.split(matcher).map((part, index) => terms.some((term) => term.toLocaleLowerCase() === part.toLocaleLowerCase())
    ? <strong key={`${index}-${part}`} className="font-semibold text-[#202124]">{part}</strong>
    : part);
};

export const SocialPreview: React.FC<SocialPreviewProps> = ({ audit }) => {
  const { t } = useTranslation();
  const openModal = useUIStore((s) => s.openModal);
  const showOnlyProblems = useAuditStore((state) => state.showOnlyProblems);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const [serpMode, setSerpMode] = useState<'desktop' | 'mobile'>('desktop');
  const [showLiveEditor, setShowLiveEditor] = useState(true);
  const [activePlatform, setActivePlatform] = useState<PlatformTab>('all');

  const initialTitle = audit.open_graph.og_title || audit.meta_tags.title || audit.url;
  const initialDesc =
    audit.open_graph.og_description ||
    audit.meta_tags.description ||
    t('legacyUi.social.noDescription');
  const initialImage =
    audit.open_graph.og_image ||
    audit.twitter_card.twitter_image ||
    audit.images.find((i) => i.src.endsWith('.jpg') || i.src.endsWith('.png'))?.src ||
    '';

  const defaultDraft: SerpDraft = { title: initialTitle, description: initialDesc, image: initialImage, query: '' };
  const currentDraftKey = serpDraftKey(activeProjectId, audit.final_url);
  const [liveDraft, setLiveDraft] = useState(() => readSerpDraft(currentDraftKey, defaultDraft));
  const [loadedDraftKey, setLoadedDraftKey] = useState(currentDraftKey);

  useEffect(() => {
    setLiveDraft(readSerpDraft(currentDraftKey, defaultDraft));
    setLoadedDraftKey(currentDraftKey);
  }, [currentDraftKey, initialTitle, initialDesc, initialImage]);

  useEffect(() => {
    if (!currentDraftKey || loadedDraftKey !== currentDraftKey) return;
    writeJsonStorage(currentDraftKey, liveDraft);
  }, [currentDraftKey, loadedDraftKey, liveDraft]);

  const liveTitle = liveDraft.title;
  const liveDesc = liveDraft.description;
  const liveImage = liveDraft.image;
  const liveQuery = liveDraft.query;
  const updateDraft = (patch: Partial<SerpDraft>) => setLiveDraft((current) => ({ ...current, ...patch }));

  const handleReset = () => {
    setLiveDraft(defaultDraft);
  };

  const siteName = audit.open_graph.og_site_name || new URL(audit.final_url).hostname;
  const displayUrl = formatSerpDisplayUrl(audit.final_url);

  const isTitleOptimal = liveTitle.length >= 40 && liveTitle.length <= 60;
  const isDescOptimal = liveDesc.length >= 120 && liveDesc.length <= 160;

  const pixelLimits = SERP_VIEWPORTS[serpMode];
  const estimatedPixelWidth = Math.round(measureSerpText(liveTitle, 20));
  const isPixelWidthOptimal = estimatedPixelWidth <= pixelLimits.title;
  const visibleTitle = truncateSerpText(liveTitle, pixelLimits.title, 20);
  const visibleDescription = truncateSerpSnippet(liveDesc, pixelLimits.snippet, 13, 2);
  const sitelinkCandidates = deriveSerpSitelinks(audit.links?.links || [], audit.final_url);
  const richResultPreview = deriveSerpRichResult(audit.structured_data || []);
  const socialProblems = getSocialProblems(audit);

  if (showOnlyProblems) {
    return <div className="mx-auto max-w-5xl animate-in fade-in duration-200 p-4 md:p-6"><ProblemsOnlyNotice problems={socialProblems} subject={t("social.socialMetadata")} /></div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-6 pb-20 animate-in fade-in duration-200">
      {/* Live Metadata Simulation Controller */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">{t('legacyUi.social.sandbox')}</h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              {t('legacyUi.social.liveInteractive')}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleReset}
              className="px-2.5 py-1 text-xs rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center space-x-1"
              title={t('legacyUi.social.resetTitle')}
            >
              <RotateCcw className="w-3 h-3" />
              <span>{t('legacyUi.social.reset')}</span>
            </button>
            <button
              onClick={() => openModal('ai')}
              className="px-2.5 py-1 text-xs rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 hover:border-emerald-500/40 transition flex items-center space-x-1"
            >
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>{t('legacyUi.social.aiOptimize')}</span>
            </button>
            <button
              onClick={() => setShowLiveEditor(!showLiveEditor)}
              className="text-xs text-slate-400 hover:text-white px-2 py-1"
            >
              {showLiveEditor ? t('legacyUi.social.collapse') : t('legacyUi.social.expand')}
            </button>
          </div>
        </div>

        {showLiveEditor && (
          <div className="space-y-4 pt-2">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-slate-300">{t('legacyUi.social.liveTitle')}</span>
                <div className="flex items-center space-x-3 font-mono text-[11px]">
                  <span className={isPixelWidthOptimal ? 'text-emerald-400' : 'text-amber-400'}>
                    ~{t('uiUnits.pixelValue', { value: estimatedPixelWidth })} / {t('uiUnits.pixelValue', { value: pixelLimits.title })} ({serpMode})
                  </span>
                  <span className={isTitleOptimal ? 'text-emerald-400' : 'text-amber-400'}>
                    {liveTitle.length} / 60 {t('uiUnits.characters')}
                  </span>
                </div>
              </div>
              <input
                type="text"
                value={liveTitle}
                onChange={(e) => updateDraft({ title: e.target.value })}
                placeholder={t('legacyUi.social.titlePlaceholder')}
                className="w-full h-9 px-3 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-slate-300">{t('legacyUi.social.liveDescription')}</span>
                <span className={`font-mono text-[11px] ${isDescOptimal ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {liveDesc.length} / 160 {t('siteAudit.characters')}
                </span>
              </div>
              <textarea
                value={liveDesc}
                onChange={(e) => updateDraft({ description: e.target.value })}
                placeholder={t('legacyUi.social.descriptionPlaceholder')}
                rows={2}
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {t('legacyUi.social.imageLabel')}
              </label>
              <input
                type="text"
                value={liveImage}
                onChange={(e) => updateDraft({ image: e.target.value })}
                placeholder={t('legacyUi.social.imagePlaceholder')}
                className="w-full h-9 px-3 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono text-[11px]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">{t('legacyUi.social.searchQueryLabel')}</label>
              <input
                type="text"
                value={liveQuery}
                onChange={(event) => updateDraft({ query: event.target.value })}
                placeholder={t('legacyUi.social.searchQueryPlaceholder')}
                className="w-full h-9 px-3 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Platform Filter Tabs */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs border-b border-slate-800">
        {[
          { id: 'all', label: t('legacyUi.social.allPreviews') },
          { id: 'google', label: t('legacyUi.social.googleSerp') },
          { id: 'facebook', label: t('legacyUi.social.facebook') },
          { id: 'twitter', label: t('legacyUi.social.twitterTab') },
          { id: 'discord', label: t('legacyUi.social.discordTab') },
          { id: 'linkedin', label: t('legacyUi.social.linkedinTab') },
          { id: 'slack', label: t('legacyUi.social.slackTab') },
          { id: 'chat', label: t('legacyUi.social.chatTab') },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActivePlatform(tab.id as PlatformTab)}
            className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
              activePlatform === tab.id
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold'
                : 'text-slate-400 hover:text-white bg-slate-900/60 border border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. Google SERP Simulator */}
      {(activePlatform === 'all' || activePlatform === 'google') && (
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
            className={`bg-[#202124] text-[#bdc1c6] p-4 rounded-xl border border-slate-800 font-sans ${
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
      )}

      {/* 2. Facebook Feed Card */}
      {(activePlatform === 'all' || activePlatform === 'facebook') && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Share2 className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white">{t('social.facebookPreview')}</h3>
          </div>

          <div className="max-w-[500px] mx-auto bg-[#242526] border border-slate-700/60 rounded-xl overflow-hidden shadow-xl">
            {liveImage ? (
              <div className="relative aspect-[1.91/1] w-full bg-slate-800 overflow-hidden">
                <img
                  src={liveImage}
                  alt={t('legacyUi.social.facebookAlt')}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            ) : (
              <div className="aspect-[1.91/1] w-full bg-slate-800 flex flex-col items-center justify-center text-slate-400 text-xs">
                <ImageIcon className="w-8 h-8 mb-1 opacity-50" />
                <span>{t('social.missingImage')}</span>
              </div>
            )}

            <div className="p-3.5 bg-[#2f3031] border-t border-slate-700/40">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block mb-0.5">
                {new URL(audit.final_url).hostname}
              </span>
              <h4 className="text-sm font-semibold text-white truncate mb-1">
              {t('social.serpPreview')}
              </h4>
              <p className="text-xs text-slate-400 line-clamp-1">
                {liveDesc}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. X / Twitter Card */}
      {(activePlatform === 'all' || activePlatform === 'twitter') && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center space-x-2 mb-4">
            <span className="font-bold text-white text-sm">{t('legacyUi.social.twitter')}</span>
          </div>

          <div className="max-w-[500px] mx-auto bg-black border border-slate-800 rounded-2xl overflow-hidden">
            {liveImage && (
              <div className="aspect-[1.91/1] w-full bg-slate-900 overflow-hidden">
                <img src={liveImage} alt={t('legacyUi.social.twitterAlt')} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-3">
              <span className="text-[11px] text-slate-400 block mb-0.5">{new URL(audit.final_url).hostname}</span>
              <h5 className="text-xs font-semibold text-white truncate mb-1">{liveTitle}</h5>
              <p className="text-xs text-slate-400 line-clamp-2">{liveDesc}</p>
            </div>
          </div>
        </div>
      )}

      {/* 4. Discord Rich Embed & LinkedIn */}
      {(activePlatform === 'all' || activePlatform === 'discord' || activePlatform === 'linkedin') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Discord Embed */}
          {(activePlatform === 'all' || activePlatform === 'discord') && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center space-x-2 mb-4">
                <span className="font-bold text-white text-sm">{t('legacyUi.social.discord')}</span>
              </div>

              <div className="bg-[#2f3136] rounded-md p-3 border-l-4 border-emerald-500 max-w-md">
                <span className="text-[11px] text-slate-400 font-medium block mb-1">
                  {siteName}
                </span>
                <h5 className="text-xs font-bold text-emerald-400 hover:underline cursor-pointer mb-1 truncate">
                  {liveTitle}
                </h5>
                <p className="text-xs text-slate-300 mb-2.5 line-clamp-2">{liveDesc}</p>
                {liveImage && (
                  <div className="rounded overflow-hidden max-h-48 bg-slate-900">
                    <img src={liveImage} alt={t('legacyUi.social.discordAlt')} className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* LinkedIn Post Card */}
          {(activePlatform === 'all' || activePlatform === 'linkedin') && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center space-x-2 mb-4">
                <span className="font-bold text-white text-sm">{t('legacyUi.social.linkedin')}</span>
              </div>

              <div className="bg-[#1b1f23] border border-slate-700/50 rounded-xl overflow-hidden max-w-md">
                {liveImage && (
                  <div className="aspect-[1.91/1] w-full bg-slate-900 overflow-hidden">
                    <img src={liveImage} alt={t('legacyUi.social.linkedinAlt')} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-3 bg-[#283e4a]/40">
                  <h5 className="text-xs font-semibold text-white truncate mb-1">{liveTitle}</h5>
                  <span className="text-[11px] text-slate-400 block">{new URL(audit.final_url).hostname}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Slack & Messaging Chat Cards */}
      {(activePlatform === 'all' || activePlatform === 'slack' || activePlatform === 'chat') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Slack Block */}
          {(activePlatform === 'all' || activePlatform === 'slack') && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center space-x-2 mb-4">
                <Hash className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-white text-sm">{t('legacyUi.social.slack')}</span>
              </div>

              <div className="border-l-4 border-slate-600 pl-3 py-1 bg-slate-950/40 rounded-r-lg max-w-md">
                <span className="text-xs font-bold text-blue-400 hover:underline cursor-pointer block mb-1">
                  {liveTitle}
                </span>
                <p className="text-xs text-slate-300 line-clamp-2 mb-2">{liveDesc}</p>
                {liveImage && (
                  <div className="w-36 h-20 rounded bg-slate-900 overflow-hidden">
                    <img src={liveImage} alt={t('legacyUi.social.slackAlt')} className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* WhatsApp & Telegram */}
          {(activePlatform === 'all' || activePlatform === 'chat') && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center space-x-2 mb-4">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-white text-sm">{t('legacyUi.social.whatsapp')}</span>
              </div>

              <div className="bg-[#1f2c34] border border-[#2a3942] rounded-xl p-3 max-w-md shadow-md">
                <div className="flex space-x-3">
                  {liveImage && (
                    <div className="w-16 h-16 rounded-lg bg-slate-900 overflow-hidden shrink-0">
                      <img src={liveImage} alt={t('legacyUi.social.chatAlt')} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h5 className="text-xs font-bold text-white truncate mb-0.5">{liveTitle}</h5>
                    <p className="text-[11px] text-slate-400 line-clamp-2 mb-1">{liveDesc}</p>
                    <span className="text-[10px] text-slate-500 font-mono">{new URL(audit.final_url).hostname}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
