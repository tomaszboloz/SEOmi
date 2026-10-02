import React from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare } from 'lucide-react';

interface SocialChatCardProps {
  liveImage: string;
  liveTitle: string;
  liveDesc: string;
  finalUrl: string;
}

export const SocialChatCard: React.FC<SocialChatCardProps> = ({
  liveImage,
  liveTitle,
  liveDesc,
  finalUrl,
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center space-x-2 mb-4">
        <MessageSquare className="w-4 h-4 text-emerald-400" />
        <span className="font-bold text-white text-sm">{t('legacyUi.social.whatsapp')}</span>
      </div>

      <div className="bg-[#1f2c34] border border-[#2a3942] rounded-xl p-3 max-w-md shadow-md">
        <div className="flex space-x-3">
          {liveImage && (
            <div className="w-16 h-16 rounded-lg bg-slate-900 overflow-hidden shrink-0">
              <img src={liveImage} alt={t('legacyUi.social.chatAlt')} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h5 className="text-xs font-bold text-white truncate mb-0.5">{liveTitle}</h5>
            <p className="text-[11px] text-slate-400 line-clamp-2 mb-1">{liveDesc}</p>
            <span className="text-[10px] text-slate-500 font-mono">{new URL(finalUrl).hostname}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
