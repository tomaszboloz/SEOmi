import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sliders, RotateCcw, Sparkles } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { SerpDraft } from './socialTypes';

interface SocialLiveEditorProps {
  showLiveEditor: boolean;
  setShowLiveEditor: (val: boolean) => void;
  handleReset: () => void;
  liveDraft: SerpDraft;
  updateDraft: (patch: Partial<SerpDraft>) => void;
  isPixelWidthOptimal: boolean;
  isTitleOptimal: boolean;
  isDescOptimal: boolean;
  estimatedPixelWidth: number;
  pixelLimits: { title: number; snippet: number };
  serpMode: 'desktop' | 'mobile';
}

export const SocialLiveEditor: React.FC<SocialLiveEditorProps> = ({
  showLiveEditor,
  setShowLiveEditor,
  handleReset,
  liveDraft,
  updateDraft,
  isPixelWidthOptimal,
  isTitleOptimal,
  isDescOptimal,
  estimatedPixelWidth,
  pixelLimits,
  serpMode,
}) => {
  const { t } = useTranslation();
  const openModal = useUIStore((s) => s.openModal);

  const { title: liveTitle, description: liveDesc, image: liveImage, query: liveQuery } = liveDraft;

  return (
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
  );
};
