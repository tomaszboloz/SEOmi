import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check } from 'lucide-react';
import { copyText } from '@/services/clipboard';
import { MetadataTableProps } from './metadataTypes';

export const MetadataOtherTags: React.FC<MetadataTableProps> = ({ audit }) => {
  const { t } = useTranslation();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!audit.meta_tags.other_tags || audit.meta_tags.other_tags.length === 0) {
    return null;
  }

  const copyToClipboard = async (text: string, key: string) => {
    const copied = await copyText(text);
    if (!copied) return;
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-800">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
          {t('legacyUi.metadata.otherTags', { count: audit.meta_tags.other_tags.length })}
        </h4>
      </div>
      <div className="divide-y divide-slate-800/80 text-xs">
        {audit.meta_tags.other_tags.map((tag, idx) => {
          const tagIdentifier = tag.name ? `name="${tag.name}"` : tag.property ? `property="${tag.property}"` : 'tag';
          return (
            <div key={idx} className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 hover:bg-slate-800/30 transition">
              <span className="font-mono font-semibold text-amber-400/90 sm:w-56 shrink-0">{tagIdentifier}</span>
              <span className="font-mono text-slate-300 break-all flex-1">{tag.content}</span>
              <button
                onClick={() => copyToClipboard(tag.content, `other-${idx}`)}
                className="text-slate-400 hover:text-white p-1 shrink-0"
                title={t('legacyUi.metadata.copyContent')}
              >
                {copiedKey === `other-${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
