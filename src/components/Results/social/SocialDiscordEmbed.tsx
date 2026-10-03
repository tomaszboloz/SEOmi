import React from 'react';
import { useTranslation } from 'react-i18next';

interface SocialDiscordEmbedProps {
  siteName: string;
  liveTitle: string;
  liveDesc: string;
  liveImage: string;
}

export const SocialDiscordEmbed: React.FC<SocialDiscordEmbedProps> = ({
  siteName,
  liveTitle,
  liveDesc,
  liveImage,
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center space-x-2 mb-4">
        <span className="font-bold text-white text-sm">{t('legacyUi.social.discord')}</span>
      </div>

      <div className="force-dark bg-[#2f3136] rounded-md p-3 border-l-4 border-emerald-500 max-w-md">
        <span className="text-[11px] text-slate-400 font-medium block mb-1">
          {siteName}
        </span>
        <h5 className="text-xs font-bold text-emerald-400 hover:underline cursor-pointer mb-1 truncate">
          {liveTitle}
        </h5>
        <p className="text-xs text-slate-300 mb-2.5 line-clamp-2">{liveDesc}</p>
        {liveImage && (
          <div className="rounded overflow-hidden max-h-48 bg-slate-900">
            <img src={liveImage} alt={t('legacyUi.social.discordAlt')} className="w-full h-full object-cover" />
          </div>
        )}
      </div>
    </div>
  );
};
