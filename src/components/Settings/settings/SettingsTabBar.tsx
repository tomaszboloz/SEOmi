import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sliders, Key, Archive, Globe, RefreshCw } from 'lucide-react';
import { SettingsTabType } from './settingsTypes';

interface SettingsTabBarProps {
  activeTab: SettingsTabType;
  setActiveTab: (tab: SettingsTabType) => void;
}

export const SettingsTabBar: React.FC<SettingsTabBarProps> = ({ activeTab, setActiveTab }) => {
  const { t } = useTranslation();

  const getTabClass = (tab: SettingsTabType) => 
    `py-3 px-3 text-xs font-semibold border-b-2 transition flex items-center space-x-1.5 ${
      activeTab === tab
        ? 'border-emerald-500 text-emerald-400'
        : 'border-transparent text-slate-400 hover:text-white'
    }`;

  return (
    <div className="flex border-b border-slate-800 px-6 bg-slate-950/40">
      <button onClick={() => setActiveTab('general')} className={getTabClass('general')}>
        <Sliders className="w-3.5 h-3.5" />
        <span>{t('settings.general')}</span>
      </button>

      <button onClick={() => setActiveTab('api')} className={getTabClass('api')}>
        <Key className="w-3.5 h-3.5" />
        <span>{t('settings.apiConfig')}</span>
      </button>

      <button onClick={() => setActiveTab('workspace')} className={getTabClass('workspace')}>
        <Archive className="w-3.5 h-3.5" />
        <span>{t('legacyUi.settings.workspace')}</span>
      </button>

      <button onClick={() => setActiveTab('language')} className={getTabClass('language')}>
        <Globe className="w-3.5 h-3.5" />
        <span>{t('settings.language')}</span>
      </button>

      <button onClick={() => setActiveTab('updates')} className={getTabClass('updates')}>
        <RefreshCw className="w-3.5 h-3.5" />
        <span>{t('settings.updates')}</span>
      </button>
    </div>
  );
};
