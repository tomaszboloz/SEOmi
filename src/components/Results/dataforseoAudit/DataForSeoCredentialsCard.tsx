import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Database, Key, Loader2, RefreshCw, CheckCircle2, Save, AlertCircle } from 'lucide-react';
import { useAuditStore } from '@/stores/auditStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useProjectStore } from '@/stores/projectStore';

interface Props {
  currentDomain: string;
}

export const DataForSeoCredentialsCard: React.FC<Props> = ({ currentDomain }) => {
  const { t } = useTranslation();
  const isLoading = useAuditStore((s) => s.isDataForSEOLoading);
  const dataforseoError = useAuditStore((s) => s.dataforseoError);
  const fetchDataForSEO = useAuditStore((s) => s.fetchDataForSEO);
  const credentials = useSettingsStore((s) => s.dataForSeoCredentials);
  const saveCredentials = useSettingsStore((s) => s.saveDataForSeoCredentials);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  const [showCredentials, setShowCredentials] = useState(false);
  const [login, setLogin] = useState(credentials.login);
  const [password, setPassword] = useState(credentials.password);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setLogin(credentials.login);
    setPassword(credentials.password);
  }, [activeProjectId, credentials.login, credentials.password]);

  const isConfigured = Boolean(credentials.login && credentials.password);
  const quotaOrRateLimitError = Boolean(dataforseoError && /quota|rate\s*limit|too many requests|insufficient funds|balance|HTTP\s+429/i.test(dataforseoError));

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveCredentials({ login, password });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-bold text-white">{t('dataforseo.title')}</h3>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${isConfigured ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
                {isConfigured ? t('dataforseo.credentialsSaved') : t('dataforseo.credentialsRequired')}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('dataforseo.targetDomain')}: <span className="font-mono text-emerald-400 font-medium">{currentDomain || '—'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button onClick={() => setShowCredentials(!showCredentials)} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium transition flex items-center space-x-1.5 border border-slate-700">
            <Key className="w-3.5 h-3.5 text-slate-400" />
            <span>{showCredentials ? t('dataforseo.hideApiKeys') : t('dataforseo.apiCredentials')}</span>
          </button>
          <button onClick={() => fetchDataForSEO(currentDomain)} disabled={isLoading || !currentDomain} className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center space-x-1.5 disabled:opacity-50">
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span>{t('dataforseo.fetchLiveMetrics')}</span>
          </button>
        </div>
      </div>

      {showCredentials && (
        <form onSubmit={handleSaveCredentials} className="mt-6 pt-5 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">{t('dataforseo.loginLabel')}</label>
            <input type="text" value={login} onChange={(e) => setLogin(e.target.value)} placeholder={t('dataforseo.loginPlaceholder')} className="w-full h-9 px-3 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">{t('dataforseo.passwordLabel')}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('dataforseo.passwordPlaceholder')} className="w-full h-9 px-3 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono" />
          </div>
          <div className="flex items-center space-x-2">
            <button type="submit" className="h-9 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center space-x-1 flex-1">
              {savedSuccess ? (
                <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /><span>{t('dataforseo.saved')}</span></>
              ) : (
                <><Save className="w-3.5 h-3.5" /><span>{t('dataforseo.saveConnect')}</span></>
              )}
            </button>
          </div>
        </form>
      )}

      {dataforseoError && (
        <div className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs ${quotaOrRateLimitError ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-rose-500/20 bg-rose-500/10 text-rose-300'}`} role="alert">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <div className="min-w-0">
            <p>{dataforseoError}</p>
            {quotaOrRateLimitError && <p className="mt-1 text-[11px] text-amber-300/80">{t('dataforseo.quotaHint')}</p>}
          </div>
        </div>
      )}
    </div>
  );
};
