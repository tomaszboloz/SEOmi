import React from 'react';
import { useTranslation } from 'react-i18next';
import { Share2, Image as ImageIcon } from 'lucide-react';

interface SocialFacebookCardProps {
  liveImage: string;
  liveDesc: string;
  finalUrl: string;
}

export const SocialFacebookCard: React.FC<SocialFacebookCardProps> = ({
  liveImage,
  liveDesc,
  finalUrl,
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Share2 className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-bold text-white">{t('social.facebookPreview')}</h3>
      </div>

      <div className="force-dark max-w-[500px] mx-auto bg-[#242526] border border-slate-700/60 rounded-xl overflow-hidden shadow-xl">
        {liveImage ? (
          <div className="relative aspect-[1.91/1] w-full bg-slate-800 overflow-hidden">
            <img
              src={liveImage}
              alt={t('legacyUi.social.facebookAlt')}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
        ) : (
          <div className="aspect-[1.91/1] w-full bg-slate-800 flex flex-col items-center justify-center text-slate-400 text-xs">
            <ImageIcon className="w-8 h-8 mb-1 opacity-50" />
            <span>{t('social.missingImage')}</span>
          </div>
        )}

        <div className="p-3.5 bg-[#2f3031] border-t border-slate-700/40">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block mb-0.5">
            {new URL(finalUrl).hostname}
          </span>
          <h4 className="text-sm font-semibold text-white truncate mb-1">
          {t('social.serpPreview')}
          </h4>
          <p className="text-xs text-slate-400 line-clamp-1">
            {liveDesc}
          </p>
        </div>
      </div>
    </div>
  );
};
