import React from 'react';
import { useTranslation } from 'react-i18next';
import { MetadataTableProps } from './metadataTypes';
import { MetadataAccessibilityGrid } from './MetadataAccessibilityGrid';
import { MetadataAccessibilityFindings } from './MetadataAccessibilityFindings';
import { MetadataAccessibilityHidden } from './MetadataAccessibilityHidden';
import { accessibilityManualReview } from './metadataHelpers';

export const MetadataAccessibility: React.FC<MetadataTableProps> = ({ audit }) => {
  const { t } = useTranslation();

  if (!audit.accessibility) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
      <div className="flex flex-col gap-1 border-b border-slate-800 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-white">{t('accessibility.title')}</h4>
        <span className="text-[11px] text-slate-500">{t('accessibility.staticChecks')}</span>
      </div>
      
      <MetadataAccessibilityGrid audit={audit} />
      <MetadataAccessibilityFindings audit={audit} />
      <MetadataAccessibilityHidden audit={audit} />
      
      {audit.accessibility.manual_review_items && (
        <div className="border-t border-amber-500/15 bg-amber-500/5 px-4 py-3 text-[11px] leading-5 text-amber-200">
          {accessibilityManualReview(audit.accessibility.manual_review_items, t)}
        </div>
      )}
    </div>
  );
};
