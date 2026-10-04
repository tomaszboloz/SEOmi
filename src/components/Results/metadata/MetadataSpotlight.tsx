import React from 'react';
import { useTranslation } from 'react-i18next';
import { Code, Copy, Check, Sparkles } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { copyText } from '@/services/clipboard';
import { MetadataTableProps } from './metadataTypes';
import { useTransientValue } from '@/hooks/useTransientValue';

export const MetadataSpotlight: React.FC<MetadataTableProps> = ({ audit }) => {
  const { t } = useTranslation();
  const openModal = useUIStore((s) => s.openModal);
  const [copiedKey, setCopiedKey] = useTransientValue<string | null>(null, 1500);

  const { meta_tags } = audit;

  const copyToClipboard = async (text: string, key: string) => {
    const copied = await copyText(text);
    if (!copied) return;
    setCopiedKey(key);
  };

  const titleLength = meta_tags.title_length;
  const isTitleOptimal = titleLength >= 40 && titleLength <= 65;

  const descLength = meta_tags.description_length;
  const isDescOptimal = descLength >= 120 && descLength <= 165;

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Code className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">{t('metadata.metaTableTitle')}</h3>
        </div>
        <button
          onClick={() => openModal('ai')}
          className="px-2.5 py-1 text-xs rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 hover:border-emerald-500/40 transition flex items-center space-x-1"
        >
          <Sparkles className="w-3 h-3 text-emerald-400" />
          <span>{t('legacyUi.metadata.aiOptimize')}</span>
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300">{t('legacyUi.metadata.pageTitle')}</span>
          <div className="flex items-center space-x-2">
            <span className={`font-mono text-[11px] ${isTitleOptimal ? 'text-emerald-400' : 'text-amber-400'}`}>
              {titleLength} / 60 {t('metadata.characters')}
            </span>
            <button
              onClick={() => copyToClipboard(meta_tags.title || '', 'title')}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"
              title={t('legacyUi.metadata.copyTitle')}
            >
              {copiedKey === 'title' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white break-words font-sans">
          {meta_tags.title || <span className="text-rose-400 italic">{t('legacyUi.metadata.missingTitle')}</span>}
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              isTitleOptimal ? 'bg-emerald-500' : titleLength > 65 ? 'bg-amber-500' : 'bg-rose-500'
            }`}
            style={{ width: `${Math.min(100, (titleLength / 60) * 100)}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300">{t('legacyUi.metadata.description')}</span>
          <div className="flex items-center space-x-2">
            <span className={`font-mono text-[11px] ${isDescOptimal ? 'text-emerald-400' : 'text-amber-400'}`}>
              {descLength} / 160 {t('metadata.characters')}
            </span>
            <button
              onClick={() => copyToClipboard(meta_tags.description || '', 'desc')}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"
              title={t('legacyUi.metadata.copyDescription')}
            >
              {copiedKey === 'desc' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-300 leading-relaxed break-words font-sans">
          {meta_tags.description || <span className="text-rose-400 italic">{t('legacyUi.metadata.missingDescription')}</span>}
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              isDescOptimal ? 'bg-emerald-500' : descLength > 165 ? 'bg-amber-500' : 'bg-rose-500'
            }`}
            style={{ width: `${Math.min(100, (descLength / 160) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};
