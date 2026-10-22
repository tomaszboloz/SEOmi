import React, { useEffect, useState } from 'react';
import { Download, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { relaunch } from '@tauri-apps/plugin-process';
import { APP_AUTHOR, APP_AUTHOR_URL, APP_LICENSE, APP_VERSION } from '@/constants/app';
import { isTauriEnvironment } from '@/services/tauri';
import { useSettingsUpdateHandlers } from '@/components/Settings/settings/useSettingsUpdateHandlers';

const ACTION = 'inline-flex items-center gap-1 text-slate-400 transition hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-60';

export const Footer: React.FC = () => {
  const { t } = useTranslation();
  const updates = useSettingsUpdateHandlers();
  const [installedVersion, setInstalledVersion] = useState<string | null>(null);
  const status = updates.updateStatus;
  const busy = updates.checkingUpdates || updates.installingUpdate;
  const restartVersion = installedVersion ?? (status?.installed || status?.restart_required ? status.version ?? '' : null);

  useEffect(() => {
    const handleUpdate = (event: Event) => {
      const version = (event as CustomEvent<{ version?: string | null }>).detail?.version;
      setInstalledVersion(version || null);
    };
    window.addEventListener('seomi-update-installed', handleUpdate);
    return () => window.removeEventListener('seomi-update-installed', handleUpdate);
  }, []);

  const message = updates.updateError
    ?? (status && !status.installed
      ? status.available
        ? t('legacyUi.settings.updateAvailable', { version: status.version || '' })
        : t('legacyUi.settings.upToDate', { version: status.current_version })
      : null);

  return (
    <footer className="flex min-h-8 shrink-0 items-center justify-between gap-3 border-t border-slate-800/80 bg-slate-950/95 px-4 py-1.5 text-[10px] text-slate-500">
      <span>{t('app.footerVersion', { version: APP_VERSION })}</span>
      <span className="hidden sm:inline">{t('app.footerAuthor')} <a href={APP_AUTHOR_URL} target="_blank" rel="noreferrer" className="text-slate-400 transition hover:text-emerald-300">{APP_AUTHOR}<ExternalLink className="ml-1 inline h-3 w-3" aria-hidden="true" /></a> · {APP_LICENSE}</span>
      {restartVersion !== null && <button type="button" onClick={() => void relaunch()} className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-amber-200 transition hover:bg-amber-500/25" title={t('legacyUi.settings.restartRequired')}>
        <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
        {t('legacyUi.settings.restartNow')} {restartVersion && t('app.footerVersion', { version: restartVersion })}
      </button>}
      {message && <span role={updates.updateError ? 'alert' : 'status'} className={updates.updateError ? 'text-rose-300' : 'text-emerald-300'}>{message}</span>}
      {status?.available && !status.installed && <button type="button" onClick={updates.handleInstallUpdate} disabled={busy || !isTauriEnvironment()} className={ACTION}>
        {updates.installingUpdate ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Download className="h-3 w-3" aria-hidden="true" />}
        {t('legacyUi.settings.installUpdate')}
      </button>}
      <button type="button" onClick={updates.handleCheckUpdates} disabled={busy} className={ACTION} title={t('app.footerUpdates')}>
        {updates.checkingUpdates ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-3 w-3" aria-hidden="true" />}
        {t('app.footerUpdates')}
      </button>
    </footer>
  );
};
