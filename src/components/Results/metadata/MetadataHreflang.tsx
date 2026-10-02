import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check } from 'lucide-react';
import { copyText } from '@/services/clipboard';
import { MetadataTableProps } from './metadataTypes';

export const MetadataHreflang: React.FC<MetadataTableProps> = ({ audit }) => {
  const { t } = useTranslation();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!audit.technical.hreflang_tags || audit.technical.hreflang_tags.length === 0) {
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
      <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
          {t('legacyUi.metadata.hreflang', { count: audit.technical.hreflang_tags.length })}
        </h4>
      </div>
      <div className="divide-y divide-slate-800/80 text-xs">
        {audit.technical.hreflang_tags.map((tag, idx) => (
          <div key={idx} className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-800/30 transition">
            <span className="font-mono font-semibold text-emerald-400 w-24 shrink-0">{tag.hreflang}</span>
            <span className="font-mono text-slate-300 break-all flex-1">{tag.href}</span>
            <button
              onClick={() => copyToClipboard(tag.href, `href-${idx}`)}
              className="text-slate-400 hover:text-white p-1"
              title={t('legacyUi.metadata.copyLink')}
            >
              {copiedKey === `href-${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
