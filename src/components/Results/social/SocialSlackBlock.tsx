import React from 'react';
import { useTranslation } from 'react-i18next';
import { Hash } from 'lucide-react';

interface SocialSlackBlockProps {
  liveTitle: string;
  liveDesc: string;
  liveImage: string;
}

export const SocialSlackBlock: React.FC<SocialSlackBlockProps> = ({
  liveTitle,
  liveDesc,
  liveImage,
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center space-x-2 mb-4">
        <Hash className="w-4 h-4 text-amber-400" />
        <span className="font-bold text-white text-sm">{t('legacyUi.social.slack')}</span>
      </div>

      <div className="border-l-4 border-slate-600 pl-3 py-1 bg-slate-950/40 rounded-r-lg max-w-md">
        <span className="text-xs font-bold text-blue-400 hover:underline cursor-pointer block mb-1">
          {liveTitle}
        </span>
        <p className="text-xs text-slate-300 line-clamp-2 mb-2">{liveDesc}</p>
        {liveImage && (
          <div className="w-36 h-20 rounded bg-slate-900 overflow-hidden">
            <img src={liveImage} alt={t('legacyUi.social.slackAlt')} className="w-full h-full object-cover" />
          </div>
        )}
      </div>
    </div>
  );
};
