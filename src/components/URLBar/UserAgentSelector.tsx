import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, Monitor, Smartphone, ChevronDown, Check } from 'lucide-react';
import { useAuditStore } from '@/stores/auditStore';

const USER_AGENT_PRESETS = [
  { id: 'chrome_mac', labelKey: 'urlBar.userAgents.chromeMac', icon: Monitor, type: 'browser' },
  { id: 'chrome_win', labelKey: 'urlBar.userAgents.chromeWin', icon: Monitor, type: 'browser' },
  { id: 'safari_mac', labelKey: 'urlBar.userAgents.safariMac', icon: Monitor, type: 'browser' },
  { id: 'googlebot_desktop', labelKey: 'urlBar.userAgents.googlebotDesktop', icon: Bot, type: 'bot' },
  { id: 'googlebot_mobile', labelKey: 'urlBar.userAgents.googlebotMobile', icon: Smartphone, type: 'bot' },
  { id: 'bingbot', labelKey: 'urlBar.userAgents.bingbot', icon: Bot, type: 'bot' },
  { id: 'iphone', labelKey: 'urlBar.userAgents.iphone', icon: Smartphone, type: 'browser' },
];

export const UserAgentSelector: React.FC = () => {
  const { t } = useTranslation();
  const selected = useAuditStore((s) => s.selectedUserAgent);
  const setSelected = useAuditStore((s) => s.setSelectedUserAgent);
  const [isOpen, setIsOpen] = useState(false);

  const activePreset = USER_AGENT_PRESETS.find((p) => p.id === selected);
  const ActiveIcon = activePreset?.icon || Monitor;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-10 px-3 flex items-center space-x-2 bg-slate-900 border border-slate-700/80 hover:border-slate-600 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition focus:outline-none focus:ring-1 focus:ring-emerald-500"
        title={t('urlBar.userAgent')}
      >
        <ActiveIcon className="w-3.5 h-3.5 text-emerald-400" />
        <span className="hidden md:inline truncate max-w-[130px]">{activePreset ? t(activePreset.labelKey) : selected}</span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-1 w-64 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl py-1.5 z-50">
            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {t('urlBar.userAgent')}
            </div>
            {USER_AGENT_PRESETS.map((preset) => {
              const Icon = preset.icon;
              const isCurrent = preset.id === selected;

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setSelected(preset.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-800 transition ${
                    isCurrent ? 'text-emerald-400 font-semibold bg-emerald-500/10' : 'text-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon className={`w-3.5 h-3.5 ${isCurrent ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <span>{t(preset.labelKey)}</span>
                  </div>
                  {isCurrent && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
