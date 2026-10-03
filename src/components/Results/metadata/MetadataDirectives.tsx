import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check } from 'lucide-react';
import { copyText } from '@/services/clipboard';
import { MetadataTableProps } from './metadataTypes';

export const MetadataDirectives: React.FC<MetadataTableProps> = ({ audit }) => {
  const { t } = useTranslation();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const { meta_tags } = audit;

  const copyToClipboard = async (text: string, key: string) => {
    const copied = await copyText(text);
    if (!copied) return;
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-800">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider">{t('legacyUi.metadata.technicalDirectives')}</h4>
      </div>

      <div className="divide-y divide-slate-800/80 text-xs">
        <div className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 hover:bg-slate-800/30 transition">
          <span className="font-semibold text-slate-400 sm:w-40 shrink-0">{t('legacyUi.metadata.canonical')}</span>
          <span className="font-mono text-slate-200 break-all flex-1">
            {meta_tags.canonical || <span className="text-amber-400">{t('legacyUi.metadata.notSpecified')}</span>}
          </span>
          {audit.indexability?.canonical_target_checked && <span className={audit.indexability.canonical_target_status && audit.indexability.canonical_target_status < 400 ? 'text-[11px] font-semibold text-emerald-300' : 'text-[11px] font-semibold text-rose-300'}>{t('exportUi.statuses.http', { status: audit.indexability.canonical_target_status })}</span>}
          {audit.indexability?.canonical_target_check_error && <span className="text-[11px] text-amber-300" title={audit.indexability.canonical_target_check_error}>{t('legacyUi.metadata.canonicalUnverified')}</span>}
          {meta_tags.canonical && (
            <button
              onClick={() => copyToClipboard(meta_tags.canonical || '', 'canonical')}
              className="text-slate-400 hover:text-white p-1"
            >
              {copiedKey === 'canonical' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        <div className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 hover:bg-slate-800/30 transition">
          <span className="font-semibold text-slate-400 sm:w-40 shrink-0">{t('legacyUi.metadata.robots')}</span>
          <span className="font-mono text-slate-200 flex-1">
            {meta_tags.robots || t('legacyUi.metadata.robotsDefault')}
          </span>
        </div>

        <div className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 hover:bg-slate-800/30 transition">
          <span className="font-semibold text-slate-400 sm:w-40 shrink-0">{t('legacyUi.metadata.viewport')}</span>
          <span className="font-mono text-slate-200 flex-1">
            {meta_tags.viewport || <span className="text-rose-400">{t('legacyUi.metadata.missingViewport')}</span>}
          </span>
        </div>

        <div className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 hover:bg-slate-800/30 transition">
          <span className="font-semibold text-slate-400 sm:w-40 shrink-0">{t('legacyUi.metadata.charset')}</span>
          <span className="font-mono text-slate-200 flex-1">
            {meta_tags.charset || t('legacyUi.metadata.utf8')}
          </span>
        </div>

        {meta_tags.keywords && (
          <div className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 hover:bg-slate-800/30 transition">
            <span className="font-semibold text-slate-400 sm:w-40 shrink-0">{t('legacyUi.metadata.keywords')}</span>
            <span className="text-slate-200 flex-1">{meta_tags.keywords}</span>
          </div>
        )}

        {meta_tags.theme_color && (
          <div className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 hover:bg-slate-800/30 transition">
            <span className="font-semibold text-slate-400 sm:w-40 shrink-0">{t('legacyUi.metadata.themeColor')}</span>
            <div className="flex items-center space-x-2 flex-1">
              <span
                className="w-4 h-4 rounded-full border border-slate-700"
                style={{ backgroundColor: meta_tags.theme_color }}
              />
              <span className="font-mono text-slate-200">{meta_tags.theme_color}</span>
            </div>
          </div>
        )}

        {meta_tags.generator && (
          <div className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 hover:bg-slate-800/30 transition">
            <span className="font-semibold text-slate-400 sm:w-40 shrink-0">{t('legacyUi.metadata.generator')}</span>
            <span className="text-slate-200 flex-1">{meta_tags.generator}</span>
          </div>
        )}

        {meta_tags.author && (
          <div className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 hover:bg-slate-800/30 transition">
            <span className="font-semibold text-slate-400 sm:w-40 shrink-0">{t('legacyUi.metadata.author')}</span>
            <span className="text-slate-200 flex-1">{meta_tags.author}</span>
          </div>
        )}
      </div>
    </div>
  );
};
