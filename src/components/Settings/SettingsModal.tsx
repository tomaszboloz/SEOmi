import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Settings as SettingsIcon,
  X,
  Globe,
  Key,
  RefreshCw,
  Sliders,
  Check,
  Moon,
  Sun,
  Monitor,
  Loader2,
  Bell,
  Archive,
  Download,
  Upload,
  ShieldCheck,
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAuthStore } from '@/stores/authStore';
import { LANGUAGES } from '@/i18n';
import { invokeTauriCommand, isTauriEnvironment, type UpdateStatus } from '@/services/tauri';
import { DataForSEOClient } from '@/services/dataforseo';
import { useProjectStore } from '@/stores/projectStore';
import { useAuditStore } from '@/stores/auditStore';
import { useToolsStore } from '@/stores/toolsStore';
import { areAuditNotificationsEnabled, disableAuditNotifications, enableAuditNotifications } from '@/services/desktopNotifications';
import { RenderWorkerPanel } from '@/components/Settings/RenderWorkerPanel';
import { useModalA11y } from '@/hooks/useModalA11y';
import {
  createProjectBackup,
  parseProjectBackup,
  restoreProjectBackup,
  serializeProjectBackup,
} from '@/services/projectBackup';
import { relaunch } from '@tauri-apps/plugin-process';

export const SettingsModal: React.FC = () => {
  const { t } = useTranslation();
  const closeModal = useUIStore((s) => s.closeModal);
  const config = useSettingsStore((s) => s.config);
  const isSaving = useSettingsStore((s) => s.isSaving);
  const configError = useSettingsStore((s) => s.configError);
  const secureStorageError = useSettingsStore((s) => s.secureStorageError);
  const dataForSeoCredentials = useSettingsStore((s) => s.dataForSeoCredentials);
  const googleMetricsApiKey = useSettingsStore((s) => s.googleMetricsApiKey);
  const saveDataForSeoCredentials = useSettingsStore((s) => s.saveDataForSeoCredentials);
  const saveGoogleMetricsApiKey = useSettingsStore((s) => s.saveGoogleMetricsApiKey);
  const loadDataForSeoCredentials = useSettingsStore((s) => s.loadDataForSeoCredentials);
  const loadGoogleMetricsApiKey = useSettingsStore((s) => s.loadGoogleMetricsApiKey);
  const updateConfig = useSettingsStore((s) => s.updateConfig);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const projects = useProjectStore((s) => s.projects);
  const createProject = useProjectStore((s) => s.createProject);
  const selectProject = useProjectStore((s) => s.selectProject);
  const activeProject = projects.find((project) => project.id === activeProjectId) || null;

  const apiKeys = useAuthStore((s) => s.apiKeys);
  const setApiKey = useAuthStore((s) => s.setApiKey);

  const [activeTab, setActiveTab] = useState<'general' | 'api' | 'language' | 'updates' | 'workspace'>('general');
  const [dataforseoLogin, setDataforseoLogin] = useState(dataForSeoCredentials.login);
  const [dataforseoPass, setDataforseoPass] = useState(dataForSeoCredentials.password);
  const [googleMetricsKey, setGoogleMetricsKey] = useState(googleMetricsApiKey);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testingDataForSeo, setTestingDataForSeo] = useState(false);
  const [dataForSeoTestStatus, setDataForSeoTestStatus] = useState<string | null>(null);
  const [auditNotificationsEnabled, setAuditNotificationsEnabled] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const backupFileInput = useRef<HTMLInputElement>(null);
  const dialogRef = useModalA11y<HTMLDivElement>(closeModal);

  useEffect(() => setGoogleMetricsKey(googleMetricsApiKey), [googleMetricsApiKey]);
  useEffect(() => {
    setDataforseoLogin(dataForSeoCredentials.login);
    setDataforseoPass(dataForSeoCredentials.password);
  }, [activeProjectId, dataForSeoCredentials.login, dataForSeoCredentials.password]);
  useEffect(() => {
    setAuditNotificationsEnabled(activeProjectId ? areAuditNotificationsEnabled(activeProjectId) : false);
    setNotificationStatus(null);
  }, [activeProjectId]);

  const handleAuditNotificationsChange = async (enabled: boolean) => {
    if (!activeProjectId) return;
    setNotificationStatus(null);
    if (!enabled) {
      disableAuditNotifications(activeProjectId);
      setAuditNotificationsEnabled(false);
      return;
    }
    const granted = await enableAuditNotifications(activeProjectId);
    setAuditNotificationsEnabled(granted);
    setNotificationStatus(granted ? t('settings.notificationsEnabled') : t('settings.notificationsDenied'));
  };

  const handleSaveGeneral = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setSavedSuccess(false);
    try {
      await saveDataForSeoCredentials({ login: dataforseoLogin, password: dataforseoPass });
      await saveGoogleMetricsApiKey(googleMetricsKey);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch {
      // The settings store keeps the translated/native storage error visible
      // in this dialog. Settling the handler prevents an unhandled rejection.
    }
  };

  const handleAiKeyChange = (provider: 'openai' | 'claude' | 'gemini', value: string) => {
    void setApiKey(provider, value).catch(() => undefined);
  };

  const handleCheckUpdates = async () => {
    setCheckingUpdates(true);
    setUpdateStatus(null);
    setUpdateError(null);
    try {
      const status = await invokeTauriCommand<UpdateStatus>('check_for_updates');
      setUpdateStatus(status);
    } catch (err: unknown) {
      setUpdateError(`${t('settings.updateError')}: ${String(err)}`);
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handleInstallUpdate = async () => {
    setInstallingUpdate(true);
    setUpdateError(null);
    try {
      const status = await invokeTauriCommand<UpdateStatus>('install_update');
      setUpdateStatus(status);
    } catch (err: unknown) {
      setUpdateError(`${t('settings.updateError')}: ${String(err)}`);
    } finally {
      setInstallingUpdate(false);
    }
  };

  const handleTestDataForSeo = async () => {
    if (!dataforseoLogin.trim() || !dataforseoPass) {
      setDataForSeoTestStatus(t('dataforseo.enterCredentials'));
      return;
    }
    setTestingDataForSeo(true);
    setDataForSeoTestStatus(null);
    try {
      await new DataForSEOClient(dataforseoLogin.trim(), dataforseoPass).verifyCredentials();
      setDataForSeoTestStatus(t('dataforseo.connectionConfirmed'));
    } catch (error) {
      setDataForSeoTestStatus(error instanceof Error ? t('dataforseo.connectionFailed', { error: error.message }) : t('dataforseo.connectionFailed', { error: t('auditProblems.unknown') }));
    } finally {
      setTestingDataForSeo(false);
    }
  };

  const handleExportProject = async () => {
    if (!activeProject) {
      setBackupStatus(t('legacyUi.settings.chooseProjectBackup'));
      return;
    }
    setBackupStatus(t('legacyUi.settings.preparingBackup'));
    try {
      const backup = await createProjectBackup(activeProject);
      const blobUrl = URL.createObjectURL(new Blob([serializeProjectBackup(backup)], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = `seomi-${activeProject.name.toLocaleLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || activeProject.id}-backup.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
      setBackupStatus(t('legacyUi.settings.backupReady', { runs: backup.crawlRuns.length, entries: Object.keys(backup.localStorage).length }));
    } catch (error) {
      setBackupStatus(error instanceof Error ? t('legacyUi.settings.backupError', { error: error.message }) : t('legacyUi.settings.backupErrorGeneric'));
    }
  };

  const handleImportProject = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBackupStatus(t('legacyUi.settings.readingBackup'));
    try {
      const backup = parseProjectBackup(await file.text());
      const importedProject = createProject({
        name: `${backup.project.name} (import)`.slice(0, 80),
        rootUrl: backup.project.rootUrl,
      });
      const summary = await restoreProjectBackup(backup, importedProject.id);
      selectProject(importedProject.id);
      useAuditStore.getState().hydrateProject(importedProject.id);
      await useToolsStore.getState().hydrateProject(importedProject.id);
      await Promise.all([loadDataForSeoCredentials(), loadGoogleMetricsApiKey()]);
      setBackupStatus(t('legacyUi.settings.restoredBackup', { name: importedProject.name, runs: summary.crawlRuns, entries: summary.storageEntries }));
    } catch (error) {
      setBackupStatus(error instanceof Error ? t('legacyUi.settings.restoreError', { error: error.message }) : t('legacyUi.settings.restoreErrorGeneric'));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="settings-modal-title" aria-describedby="settings-modal-description" tabIndex={-1} className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-slate-800 text-slate-300">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 id="settings-modal-title" className="text-sm font-bold text-white">{t('sidebar.settings')}</h3>
              <p id="settings-modal-description" className="text-[11px] text-slate-400">{t('legacyUi.settings.description')}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeModal}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            aria-label={t('settings.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 px-6 bg-slate-950/40">
          <button
            onClick={() => setActiveTab('general')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition flex items-center space-x-1.5 ${
              activeTab === 'general'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{t('settings.general')}</span>
          </button>

          <button
            onClick={() => setActiveTab('api')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition flex items-center space-x-1.5 ${
              activeTab === 'api'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>{t('settings.apiConfig')}</span>
          </button>

          <button
            onClick={() => setActiveTab('workspace')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition flex items-center space-x-1.5 ${
              activeTab === 'workspace'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>{t('legacyUi.settings.workspace')}</span>
          </button>

          <button
            onClick={() => setActiveTab('language')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition flex items-center space-x-1.5 ${
              activeTab === 'language'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{t('settings.language')}</span>
          </button>

          <button
            onClick={() => setActiveTab('updates')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition flex items-center space-x-1.5 ${
              activeTab === 'updates'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t('settings.updates')}</span>
          </button>
        </div>

        {configError && (
          <div role="alert" className="mx-6 mt-4 rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            {configError}
          </div>
        )}

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {activeTab === 'general' && (
            <div className="space-y-4 text-xs">
              {/* Theme Picker */}
              <div>
                <label className="font-semibold text-slate-300 block mb-2">{t('settings.theme')}</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setTheme('dark')}
                    className={`p-3 rounded-xl border flex items-center justify-center space-x-2 transition ${
                      theme === 'dark'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    <Moon className="w-4 h-4" />
                    <span>{t('settings.dark')}</span>
                  </button>
                  <button
                    onClick={() => setTheme('light')}
                    className={`p-3 rounded-xl border flex items-center justify-center space-x-2 transition ${
                      theme === 'light'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    <span>{t('settings.light')}</span>
                  </button>
                  <button
                    onClick={() => setTheme('system')}
                    className={`p-3 rounded-xl border flex items-center justify-center space-x-2 transition ${
                      theme === 'system'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    <Monitor className="w-4 h-4" />
                    <span>{t('settings.system')}</span>
                  </button>
                </div>
              </div>

              {/* Request Timeout */}
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
                    onChange={(event) => void handleAuditNotificationsChange(event.target.checked)}
                    aria-label={t('settings.auditNotifications')}
                    className="mt-0.5 h-4 w-4 accent-emerald-500 disabled:opacity-40"
                  />
                </label>
                {notificationStatus && <p role="status" className="mt-2 text-[11px] text-slate-400">{notificationStatus}</p>}
              </div>

              <RenderWorkerPanel />

              {/* Request Timeout */}
              <div>
                <label className="font-semibold text-slate-300 block mb-1">{t('settings.timeout')}</label>
                <input
                  type="number"
                  min="3"
                  max="60"
                  value={config.request_timeout_secs}
                  onChange={(e) => updateConfig({ request_timeout_secs: Number(e.target.value) })}
                  className="w-full h-9 px-3 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>

              {/* Max Redirects */}
              <div>
                <label className="font-semibold text-slate-300 block mb-1">{t('legacyUi.settings.maxRedirectHops')}</label>
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={config.max_redirects}
                  onChange={(e) => updateConfig({ max_redirects: Number(e.target.value) })}
                  className="w-full h-9 px-3 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>

              <div>
                <label htmlFor="settings-default-user-agent" className="font-semibold text-slate-300 block mb-1">{t('settings.defaultUserAgent')}</label>
                <select
                  id="settings-default-user-agent"
                  value={config.default_user_agent}
                  onChange={(event) => updateConfig({ default_user_agent: event.target.value })}
                  className="w-full h-9 px-3 bg-slate-950 border border-slate-800 rounded-lg text-white"
                >
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
                <input
                  type="checkbox"
                  checked={config.verify_ssl}
                  onChange={(event) => updateConfig({ verify_ssl: event.target.checked })}
                  aria-describedby="settings-verify-ssl-description"
                  className="mt-0.5 h-4 w-4 accent-emerald-500"
                />
                <span>
                  <span className="block font-semibold text-slate-200">{t('settings.verifySsl')}</span>
                  <span id="settings-verify-ssl-description" className="mt-1 block text-[11px] leading-5 text-slate-400">{t('settings.verifySslDescription')}</span>
                </span>
              </label>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="space-y-4 text-xs">
              <div className="space-y-3 p-4 bg-slate-950/80 rounded-xl border border-slate-800">
                <h4 className="font-bold text-white">{t('dataforseo.title')}</h4>
                <p className="text-[11px] text-slate-400">
                  {t('dataforseo.settingsDescription')}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">{t('dataforseo.loginLabel')}</label>
                    <input
                      type="text"
                      value={dataforseoLogin}
                      onChange={(e) => setDataforseoLogin(e.target.value)}
                      placeholder={t('dataforseo.loginPlaceholder')}
                      className="w-full h-9 px-3 bg-slate-900 border border-slate-800 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">{t('dataforseo.passwordLabel')}</label>
                    <input
                      type="password"
                      value={dataforseoPass}
                      onChange={(e) => setDataforseoPass(e.target.value)}
                      placeholder={t('dataforseo.passwordPlaceholder')}
                      className="w-full h-9 px-3 bg-slate-900 border border-slate-800 rounded-lg text-white"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button type="button" onClick={() => void handleTestDataForSeo()} disabled={testingDataForSeo} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60">{testingDataForSeo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}{testingDataForSeo ? t('dataforseo.testingConnection') : t('dataforseo.testConnection')}</button>
                  {dataForSeoTestStatus && <p className="text-[11px] leading-4 text-slate-400">{dataForSeoTestStatus}</p>}
                </div>
              </div>

              <div className="space-y-3 p-4 bg-slate-950/80 rounded-xl border border-slate-800">
                <h4 className="font-bold text-white">{t('legacyUi.settings.pagespeed')}</h4>
                <p className="text-[11px] leading-5 text-slate-400">
                  {t('legacyUi.settings.googleDescription')}
                </p>
                <div>
                  <label className="text-slate-400 block mb-1">{t('legacyUi.settings.googleApiKey')}</label>
                  <input
                    type="password"
                    value={googleMetricsKey}
                    onChange={(e) => setGoogleMetricsKey(e.target.value)}
                    placeholder={t('legacyUi.settings.googlePlaceholder')}
                    autoComplete="new-password"
                    className="w-full h-9 px-3 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div className="space-y-3 p-4 bg-slate-950/80 rounded-xl border border-slate-800">
                <h4 className="font-bold text-white">{t('legacyUi.settings.aiProviderKeys')}</h4>
                <div className="space-y-2">
                  <div>
                    <label className="text-slate-400 block mb-1">{t('legacyUi.settings.openaiApiKey')}</label>
                    <input
                      type="password"
                      value={apiKeys.openai}
                      onChange={(e) => handleAiKeyChange('openai', e.target.value)}
                      className="w-full h-9 px-3 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">{t('legacyUi.settings.claudeApiKey')}</label>
                    <input
                      type="password"
                      value={apiKeys.claude}
                      onChange={(e) => handleAiKeyChange('claude', e.target.value)}
                      className="w-full h-9 px-3 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">{t('legacyUi.settings.geminiApiKey')}</label>
                    <input
                      type="password"
                      value={apiKeys.gemini}
                      onChange={(e) => handleAiKeyChange('gemini', e.target.value)}
                      className="w-full h-9 px-3 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {secureStorageError && (
                <p role="alert" className="text-[11px] leading-4 text-rose-300">
                  {secureStorageError}
                </p>
              )}
              <button
                type="button"
                onClick={(event) => void handleSaveGeneral(event)}
                disabled={isSaving}
                aria-busy={isSaving}
                className="w-full h-9 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savedSuccess ? t('legacyUi.settings.saved') : t('legacyUi.settings.saveApi')}
              </button>
            </div>
          )}

          {activeTab === 'language' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {LANGUAGES.map((l) => {
                const isCurrent = language === l.code;
                return (
                  <button
                    key={l.code}
                    onClick={() => setLanguage(l.code)}
                    className={`p-3 rounded-xl border flex items-center justify-between text-left transition ${
                      isCurrent
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <span className="font-semibold block">{l.nativeName}</span>
                      <span className="text-[11px] text-slate-400">{l.name}</span>
                    </div>
                    {isCurrent && <Check className="w-4 h-4 text-emerald-400" />}
                  </button>
                );
              })}
            </div>
          )}

          {activeTab === 'workspace' && (
            <div className="space-y-4 text-xs">
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex items-start gap-3">
                  <Archive className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                  <div>
                    <h4 className="font-bold text-white">{t('legacyUi.settings.backupTitle')}</h4>
                    <p className="mt-1 leading-5 text-slate-400">
                      {t('legacyUi.settings.backupDescriptionLong')}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleExportProject()}
                    disabled={!activeProject}
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-500 px-3 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    {t('legacyUi.settings.backupExport')}
                  </button>
                  <button
                    type="button"
                    onClick={() => backupFileInput.current?.click()}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 font-semibold text-slate-200 transition hover:border-emerald-400/50 hover:text-white"
                  >
                    <Upload className="h-4 w-4" />
                    {t('legacyUi.settings.backupImport')}
                  </button>
                  <input
                    ref={backupFileInput}
                    type="file"
                    accept="application/json,.json"
                    onChange={(event) => void handleImportProject(event)}
                    className="sr-only"
                    aria-label={t('legacyUi.settings.backupFile')}
                  />
                </div>
                {backupStatus && <p role="status" className="mt-3 rounded-lg border border-slate-800 bg-slate-900/80 p-3 leading-5 text-slate-300">{backupStatus}</p>}
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-slate-300">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <p className="leading-5">{t('legacyUi.settings.backupSafety')}</p>
              </div>
            </div>
          )}

          {activeTab === 'updates' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-white block mb-0.5">{t('legacyUi.settings.installedVersion')}</span>
                  <span className="text-slate-400 font-mono">{t('legacyUi.settings.releaseVersion')}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleCheckUpdates}
                    disabled={checkingUpdates || installingUpdate}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition flex items-center space-x-1.5 border border-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {checkingUpdates ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span>{t('legacyUi.settings.checkUpdates')}</span>
                  </button>
                  {updateStatus?.available && !updateStatus.installed && (
                    <button
                      type="button"
                      onClick={() => void handleInstallUpdate()}
                      disabled={installingUpdate || !isTauriEnvironment()}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition flex items-center space-x-1.5 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {installingUpdate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      <span>{t('legacyUi.settings.installUpdate')}</span>
                    </button>
                  )}
                </div>
              </div>

              {updateStatus && <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl">
                {updateStatus.installed
                  ? <span>{t('legacyUi.settings.updateInstalled', { version: updateStatus.version || '' })}</span>
                  : updateStatus.available
                    ? <span>{t('legacyUi.settings.updateAvailable', { version: updateStatus.version || '' })}</span>
                    : <span>{t('legacyUi.settings.upToDate', { version: updateStatus.current_version })}</span>}
              </div>}
              {updateStatus?.restart_required && <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200">
                <span>{t('legacyUi.settings.restartRequired')}</span>
                <button type="button" onClick={() => void relaunch()} className="rounded-lg bg-amber-400 px-3 py-1.5 font-semibold text-slate-950 transition hover:bg-amber-300">{t('legacyUi.settings.restartNow')}</button>
              </div>}
              {updateError && <div role="alert" className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl">{updateError}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
