import React from 'react';
import { useTranslation } from 'react-i18next';

interface SocialLinkedInCardProps {
  liveImage: string;
  liveTitle: string;
  finalUrl: string;
}

export const SocialLinkedInCard: React.FC<SocialLinkedInCardProps> = ({
  liveImage,
  liveTitle,
  finalUrl,
}) => {
  const { t } = useTranslation();

  return (
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
          <span className="text-[11px] text-slate-400 block">{new URL(finalUrl).hostname}</span>
        </div>
      </div>
    </div>
  );
};
