import React from 'react';
import { useTranslation } from 'react-i18next';

interface SocialTwitterCardProps {
  liveImage: string;
  liveTitle: string;
  liveDesc: string;
  finalUrl: string;
}

export const SocialTwitterCard: React.FC<SocialTwitterCardProps> = ({
  liveImage,
  liveTitle,
  liveDesc,
  finalUrl,
}) => {
  const { t } = useTranslation();

  return (
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
          <span className="text-[11px] text-slate-400 block mb-0.5">{new URL(finalUrl).hostname}</span>
          <h5 className="text-xs font-semibold text-white truncate mb-1">{liveTitle}</h5>
          <p className="text-xs text-slate-400 line-clamp-2">{liveDesc}</p>
        </div>
      </div>
    </div>
  );
};
