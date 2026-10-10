import React from 'react';
import { useTranslation } from 'react-i18next';
import { Moon, Sun, Monitor, Bell } from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useProjectStore } from '@/stores/projectStore';
import { isTauriEnvironment } from '@/services/tauri';
import { RenderWorkerPanel } from '@/components/Settings/RenderWorkerPanel';
import { MonitoringAlertsPanel } from '@/components/Settings/MonitoringAlertsPanel';

interface GeneralSettingsTabProps {
  auditNotificationsEnabled: boolean;
  notificationStatus: string | null;
  handleAuditNotificationsChange: (enabled: boolean) => void;
}

export const GeneralSettingsTab: React.FC<GeneralSettingsTabProps> = ({
  auditNotificationsEnabled,
  notificationStatus,
  handleAuditNotificationsChange
}) => {
  const { t } = useTranslation();
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const config = useSettingsStore((s) => s.config);
  const updateConfig = useSettingsStore((s) => s.updateConfig);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  const getThemeClass = (tName: string) => `p-3 rounded-xl border flex items-center justify-center space-x-2 transition ${
    theme === tName
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40'
      : 'bg-slate-950 text-slate-400 border-slate-800'
  }`;

  return (
    <div className="space-y-4 text-xs">
      <div>
        <label className="font-semibold text-slate-300 block mb-2">{t('settings.theme')}</label>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => setTheme('dark')} className={getThemeClass('dark')}><Moon className="w-4 h-4" /><span>{t('settings.dark')}</span></button>
          <button onClick={() => setTheme('light')} className={getThemeClass('light')}><Sun className="w-4 h-4" /><span>{t('settings.light')}</span></button>
          <button onClick={() => setTheme('system')} className={getThemeClass('system')}><Monitor className="w-4 h-4" /><span>{t('settings.system')}</span></button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <label className="flex items-start gap-3">
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-slate-200">{t('settings.auditNotifications')}</span>
            <span className="mt-1 block text-[11px] leading-5 text-slate-400">{t('settings.auditNotificationsDescription')}</span>
          </span>
          <input
            type="checkbox"
            checked={auditNotificationsEnabled}
            disabled={!activeProjectId || !isTauriEnvironment()}
            onChange={(e) => handleAuditNotificationsChange(e.target.checked)}
            aria-label={t('settings.auditNotifications')}
            className="mt-0.5 h-4 w-4 accent-emerald-500 disabled:opacity-40"
          />
        </label>
        {notificationStatus && <p role="status" className="mt-2 text-[11px] text-slate-400">{notificationStatus}</p>}
      </div>

      <MonitoringAlertsPanel />

      <RenderWorkerPanel />

      <div>
        <label className="font-semibold text-slate-300 block mb-1">{t('settings.timeout')}</label>
        <input type="number" min="3" max="60" value={config.request_timeout_secs} onChange={(e) => updateConfig({ request_timeout_secs: Number(e.target.value) })} className="w-full h-9 px-3 bg-slate-950 border border-slate-800 rounded-lg text-white" />
      </div>

      <div>
        <label className="font-semibold text-slate-300 block mb-1">{t('legacyUi.settings.maxRedirectHops')}</label>
        <input type="number" min="1" max="15" value={config.max_redirects} onChange={(e) => updateConfig({ max_redirects: Number(e.target.value) })} className="w-full h-9 px-3 bg-slate-950 border border-slate-800 rounded-lg text-white" />
      </div>

      <div>
        <label htmlFor="settings-default-user-agent" className="font-semibold text-slate-300 block mb-1">{t('settings.defaultUserAgent')}</label>
        <select id="settings-default-user-agent" value={config.default_user_agent} onChange={(e) => updateConfig({ default_user_agent: e.target.value })} className="w-full h-9 px-3 bg-slate-950 border border-slate-800 rounded-lg text-white">
          <option value="chrome_mac">{t('urlBar.userAgents.chromeMac')}</option>
          <option value="chrome_win">{t('urlBar.userAgents.chromeWin')}</option>
          <option value="safari_mac">{t('urlBar.userAgents.safariMac')}</option>
          <option value="googlebot_desktop">{t('urlBar.userAgents.googlebotDesktop')}</option>
          <option value="googlebot_mobile">{t('urlBar.userAgents.googlebotMobile')}</option>
          <option value="bingbot">{t('urlBar.userAgents.bingbot')}</option>
          <option value="iphone">{t('urlBar.userAgents.iphone')}</option>
          {!['chrome_mac', 'chrome_win', 'safari_mac', 'googlebot_desktop', 'googlebot_mobile', 'bingbot', 'iphone'].includes(config.default_user_agent) && (
            <option value={config.default_user_agent}>{config.default_user_agent}</option>
          )}
        </select>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <input type="checkbox" checked={config.verify_ssl} onChange={(e) => updateConfig({ verify_ssl: e.target.checked })} aria-describedby="settings-verify-ssl-description" className="mt-0.5 h-4 w-4 accent-emerald-500" />
        <span>
          <span className="block font-semibold text-slate-200">{t('settings.verifySsl')}</span>
          <span id="settings-verify-ssl-description" className="mt-1 block text-[11px] leading-5 text-slate-400">{t('settings.verifySslDescription')}</span>
        </span>
      </label>
    </div>
  );
};
