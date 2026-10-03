import React from 'react';
import { useTranslation } from 'react-i18next';
import { PlatformTab } from './socialTypes';

interface SocialPlatformTabsProps {
  activePlatform: PlatformTab;
  setActivePlatform: (val: PlatformTab) => void;
}

export const SocialPlatformTabs: React.FC<SocialPlatformTabsProps> = ({
  activePlatform,
  setActivePlatform,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs border-b border-slate-800">
      {[
        { id: 'all', label: t('legacyUi.social.allPreviews') },
        { id: 'google', label: t('legacyUi.social.googleSerp') },
        { id: 'facebook', label: t('legacyUi.social.facebook') },
        { id: 'twitter', label: t('legacyUi.social.twitterTab') },
        { id: 'discord', label: t('legacyUi.social.discordTab') },
        { id: 'linkedin', label: t('legacyUi.social.linkedinTab') },
        { id: 'slack', label: t('legacyUi.social.slackTab') },
        { id: 'chat', label: t('legacyUi.social.chatTab') },
      ].map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActivePlatform(tab.id as PlatformTab)}
          className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
            activePlatform === tab.id
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold'
              : 'text-slate-400 hover:text-white bg-slate-900/60 border border-transparent'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};
