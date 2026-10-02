import React from 'react';
import { useTranslation } from 'react-i18next';
import { MetadataTableProps } from './metadataTypes';

export const MetadataAccessibilityGrid: React.FC<MetadataTableProps> = ({ audit }) => {
  const { t } = useTranslation();

  return (
    <div className="grid gap-px bg-slate-800 sm:grid-cols-2">
      <div className="bg-slate-900/60 p-4">
        <p className="text-[11px] text-slate-500">{t('accessibility.documentLanguage')}</p>
        <p className={audit.accessibility?.document_language ? 'mt-1 font-mono text-sm text-emerald-300' : 'mt-1 text-sm text-amber-300'}>
          {audit.accessibility?.document_language || t('accessibility.missingLang')}
        </p>
      </div>
      <div className="bg-slate-900/60 p-4">
        <p className="text-[11px] text-slate-500">{t('accessibility.unlabeledControls')}</p>
        <p className={audit.accessibility?.unlabeled_form_control_count ? 'mt-1 text-sm font-semibold text-amber-300' : 'mt-1 text-sm font-semibold text-emerald-300'}>
          {audit.accessibility?.unlabeled_form_control_count ?? 0} / {audit.accessibility?.form_control_count ?? 0}
        </p>
      </div>
      <div className="bg-slate-900/60 p-4">
        <p className="text-[11px] text-slate-500">{t('accessibility.landmarks')}</p>
        <p className="mt-1 text-xs text-slate-300">
          {audit.accessibility?.landmarks?.map((landmark) => `${landmark.name} (${landmark.count})`).join(', ') || t('accessibility.noLandmarks')}
        </p>
      </div>
      <div className="bg-slate-900/60 p-4">
        <p className="text-[11px] text-slate-500">{t('accessibility.ariaAttributes')}</p>
        <p className="mt-1 text-sm font-semibold text-slate-200">{audit.accessibility?.aria_attribute_count ?? 0}</p>
      </div>
    </div>
  );
};
