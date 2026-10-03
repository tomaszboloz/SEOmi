import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sun,
  Moon,
  Settings as SettingsIcon,
  Sparkles,
  Layers,
  History,
  Search,
} from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { HeaderLanguageSelector } from './header/HeaderLanguageSelector';
import { ProjectSwitcher } from '@/components/Projects/ProjectSwitcher';

export const Header: React.FC = () => {
  const { t } = useTranslation();
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const openModal = useUIStore((s) => s.openModal);
  const openCommandPalette = useUIStore((s) => s.openCommandPalette);
  const provider = useAuthStore((s) => s.provider);
  // Subscribe to the status itself: selecting the `isProviderConnected`
  // function never re-renders when a connection is established later.
  const isConnected = useAuthStore((s) => s.connectionStatus[s.provider] === 'connected');
  const providerLabel =
    provider === 'claude'
      ? t('legacyUi.ai.claude')
      : provider === 'openai'
        ? t('legacyUi.ai.openai')
        : t('legacyUi.ai.gemini');

  return (
    <header className="h-14 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-4 flex items-center justify-between z-30 sticky top-0">
      {/* Brand logo & tagline */}
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 p-[1.5px] shadow-sm shadow-emerald-500/20">
          <div className="w-full h-full bg-slate-900 rounded-[7px] flex items-center justify-center">
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-base tracking-tight text-white">{t('app.name')}</span>
            <ProjectSwitcher />
          </div>
          <p className="text-[11px] text-slate-400 hidden sm:block">
            {t('app.tagline')}
          </p>
        </div>
      </div>

      {/* Right actions: navigation, AI subscriptions, AI assistant, language, theme, history, settings */}
      <div className="flex items-center space-x-2 sm:space-x-2.5">
        <button
          type="button"
          onClick={openCommandPalette}
          className="hidden items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-700 hover:text-white md:flex"
          title={t('header.quickNavigationTitle')}
          aria-label={t('header.openQuickNavigation')}
        >
          <Search className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
          <span>{t('header.goTo')}</span>
          <kbd className="rounded border border-slate-700 px-1 py-0.5 text-[9px] text-slate-500">{t('uiUnits.commandPaletteShortcut')}</kbd>
        </button>
        {/* Direct AI Subscriptions Indicator */}
        <button
          onClick={() => openModal('subscription')}
          className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition"
          title={t('header.aiConnectionTitle')}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-slate-600'
            }`}
          />
          <span className="hidden sm:inline font-medium">
            {isConnected ? `${providerLabel} ${t('header.active')}` : t('header.connectAi')}
          </span>
          <span className="px-1 py-0.2 bg-slate-800 text-slate-400 rounded text-[9px] font-mono uppercase">
            {isConnected ? t('header.direct') : t('header.byok')}
          </span>
        </button>

        {/* AI Assistant shortcut */}
        <button
          onClick={() => openModal('ai')}
          className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 hover:border-emerald-500/40 transition"
          title={t('header.aiOptimizerTitle')}
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden md:inline">{t('sidebar.aiAssistant')}</span>
        </button>

        {/* Audit History shortcut */}
        <button
          onClick={() => openModal('history')}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-md transition"
          title={t('urlBar.history')}
        >
          <History className="w-4 h-4" />
        </button>

        {/* Language selector dropdown */}
        <HeaderLanguageSelector />

        {/* Theme toggle */}
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-md transition"
          title={theme === 'dark' ? t('settings.light') : t('settings.dark')}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Settings button */}
        <button
          type="button"
          aria-label={t('sidebar.settings')}
          onClick={() => openModal('settings')}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-md transition"
          title={t('sidebar.settings')}
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
