import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { getSocialProblems } from '@/services/auditProblems';
import { writeJsonStorage } from '@/services/storage';
import {
  deriveSerpRichResult, deriveSerpSitelinks, formatSerpDisplayUrl,
  measureSerpText, SERP_VIEWPORTS, truncateSerpSnippet, truncateSerpText
} from '@/services/serpPreview';
import { ProblemsOnlyNotice } from './ProblemsOnlyNotice';
import { SocialPreviewProps, PlatformTab, SerpDraft } from './social/socialTypes';
import { readSerpDraft, serpDraftKey } from './social/socialHelpers';
import { SocialLiveEditor } from './social/SocialLiveEditor';
import { SocialPlatformTabs } from './social/SocialPlatformTabs';
import { SocialGoogleSerp } from './social/SocialGoogleSerp';
import { SocialFacebookCard } from './social/SocialFacebookCard';
import { SocialTwitterCard } from './social/SocialTwitterCard';
import { SocialDiscordEmbed } from './social/SocialDiscordEmbed';
import { SocialLinkedInCard } from './social/SocialLinkedInCard';
import { SocialSlackBlock } from './social/SocialSlackBlock';
import { SocialChatCard } from './social/SocialChatCard';

export const SocialPreview: React.FC<SocialPreviewProps> = ({ audit }) => {
  const { t } = useTranslation();
  const showOnlyProblems = useAuditStore((state) => state.showOnlyProblems);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  
  const [serpMode, setSerpMode] = useState<'desktop' | 'mobile'>('desktop');
  const [showLiveEditor, setShowLiveEditor] = useState(true);
  const [activePlatform, setActivePlatform] = useState<PlatformTab>('all');

  const initialTitle = audit.open_graph.og_title || audit.meta_tags.title || audit.url;
  const initialDesc = audit.open_graph.og_description || audit.meta_tags.description || t('legacyUi.social.noDescription');
  const initialImage = audit.open_graph.og_image || audit.twitter_card.twitter_image || audit.images.find((i) => i.src.endsWith('.jpg') || i.src.endsWith('.png'))?.src || '';

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

  const updateDraft = (patch: Partial<SerpDraft>) => setLiveDraft((current) => ({ ...current, ...patch }));
  const handleReset = () => setLiveDraft(defaultDraft);

  const siteName = audit.open_graph.og_site_name || new URL(audit.final_url).hostname;
  const displayUrl = formatSerpDisplayUrl(audit.final_url);
  
  const pixelLimits = SERP_VIEWPORTS[serpMode];
  const estimatedPixelWidth = Math.round(measureSerpText(liveDraft.title, 20));
  const isPixelWidthOptimal = estimatedPixelWidth <= pixelLimits.title;
  const visibleTitle = truncateSerpText(liveDraft.title, pixelLimits.title, 20);
  const visibleDescription = truncateSerpSnippet(liveDraft.description, pixelLimits.snippet, 13, 2);
  
  const isTitleOptimal = liveDraft.title.length >= 40 && liveDraft.title.length <= 60;
  const isDescOptimal = liveDraft.description.length >= 120 && liveDraft.description.length <= 160;

  if (showOnlyProblems) {
    return <div className="mx-auto max-w-5xl animate-in fade-in duration-200 p-4 md:p-6"><ProblemsOnlyNotice problems={getSocialProblems(audit)} subject={t("social.socialMetadata")} /></div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-6 pb-20 animate-in fade-in duration-200">
      <SocialLiveEditor
        showLiveEditor={showLiveEditor} setShowLiveEditor={setShowLiveEditor} handleReset={handleReset}
        liveDraft={liveDraft} updateDraft={updateDraft} isPixelWidthOptimal={isPixelWidthOptimal}
        isTitleOptimal={isTitleOptimal} isDescOptimal={isDescOptimal} estimatedPixelWidth={estimatedPixelWidth}
        pixelLimits={pixelLimits} serpMode={serpMode}
      />
      <SocialPlatformTabs activePlatform={activePlatform} setActivePlatform={setActivePlatform} />
      
      {(activePlatform === 'all' || activePlatform === 'google') && (
        <SocialGoogleSerp serpMode={serpMode} setSerpMode={setSerpMode} audit={audit} siteName={siteName} displayUrl={displayUrl} visibleTitle={visibleTitle} visibleDescription={visibleDescription} liveQuery={liveDraft.query} liveTitle={liveDraft.title} liveDesc={liveDraft.description} estimatedPixelWidth={estimatedPixelWidth} sitelinkCandidates={deriveSerpSitelinks(audit.links?.links || [], audit.final_url)} richResultPreview={deriveSerpRichResult(audit.structured_data || [])} />
      )}
      {(activePlatform === 'all' || activePlatform === 'facebook') && (
        <SocialFacebookCard liveImage={liveDraft.image} liveDesc={liveDraft.description} finalUrl={audit.final_url} />
      )}
      {(activePlatform === 'all' || activePlatform === 'twitter') && (
        <SocialTwitterCard liveImage={liveDraft.image} liveTitle={liveDraft.title} liveDesc={liveDraft.description} finalUrl={audit.final_url} />
      )}
      {(activePlatform === 'all' || activePlatform === 'discord' || activePlatform === 'linkedin') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {(activePlatform === 'all' || activePlatform === 'discord') && <SocialDiscordEmbed siteName={siteName} liveTitle={liveDraft.title} liveDesc={liveDraft.description} liveImage={liveDraft.image} />}
          {(activePlatform === 'all' || activePlatform === 'linkedin') && <SocialLinkedInCard liveImage={liveDraft.image} liveTitle={liveDraft.title} finalUrl={audit.final_url} />}
        </div>
      )}
      {(activePlatform === 'all' || activePlatform === 'slack' || activePlatform === 'chat') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {(activePlatform === 'all' || activePlatform === 'slack') && <SocialSlackBlock liveTitle={liveDraft.title} liveDesc={liveDraft.description} liveImage={liveDraft.image} />}
          {(activePlatform === 'all' || activePlatform === 'chat') && <SocialChatCard liveImage={liveDraft.image} liveTitle={liveDraft.title} liveDesc={liveDraft.description} finalUrl={audit.final_url} />}
        </div>
      )}
    </div>
  );
};

export type { SocialPreviewProps } from './social/socialTypes';
