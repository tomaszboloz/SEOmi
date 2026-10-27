import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useProjectStore } from '@/stores/projectStore';
import { DataForSeoBudgetSettings } from '@/components/DataForSEO/cost/DataForSeoBudgetSettings';
import { LlmEconomyPanel } from '@/components/AI/LlmEconomyPanel';
import { LlmEconomyBudgetSettings } from '@/components/AI/LlmEconomyBudgetSettings';
import { SecretKeyField } from '@/components/Auth/SecretKeyField';

interface ApiSettingsTabProps {
  dataforseoLogin: string;
  setDataforseoLogin: (v: string) => void;
  dataforseoPass: string;
  setDataforseoPass: (v: string) => void;
  testingDataForSeo: boolean;
  dataForSeoTestStatus: string | null;
  handleTestDataForSeo: () => void;
  googleMetricsKey: string;
  setGoogleMetricsKey: (v: string) => void;
  handleAiKeyChange: (provider: 'openai' | 'claude' | 'gemini', value: string) => Promise<void>;
  handleSaveGeneral: (e: React.SyntheticEvent) => void;
  savedSuccess: boolean;
}

export const ApiSettingsTab: React.FC<ApiSettingsTabProps> = ({
  dataforseoLogin, setDataforseoLogin,
  dataforseoPass, setDataforseoPass,
  testingDataForSeo, dataForSeoTestStatus, handleTestDataForSeo,
  googleMetricsKey, setGoogleMetricsKey,
  handleAiKeyChange, handleSaveGeneral, savedSuccess
}) => {
  const { t } = useTranslation();
  const apiKeys = useAuthStore((s) => s.apiKeys);
  const activeProvider = useAuthStore((s) => s.provider);
  const secureStorageError = useSettingsStore((s) => s.secureStorageError);
  const isSaving = useSettingsStore((s) => s.isSaving);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const dataForSeoStored = useSettingsStore((s) => s.dataForSeoCredentials);
  const googleKeyStored = useSettingsStore((s) => s.googleMetricsApiKey);
  // Stored values never reach this form; the placeholder says one exists instead of looking empty.
  const hint = (stored: string, empty: string) => stored.trim() ? t('auth.apiKeyStoredPlaceholder') : empty;

  return (
    <div className="space-y-4 text-xs">
      <div className="space-y-3 p-4 bg-slate-950/80 rounded-xl border border-slate-800">
        <h4 className="font-bold text-white">{t('dataforseo.title')}</h4>
        <p className="text-[11px] text-slate-400">{t('dataforseo.settingsDescription')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-slate-400 block mb-1">{t('dataforseo.loginLabel')}</label>
            <input type="text" value={dataforseoLogin} onChange={(e) => setDataforseoLogin(e.target.value)} placeholder={hint(dataForSeoStored.login, t('dataforseo.loginPlaceholder'))} className="w-full h-9 px-3 bg-slate-900 border border-slate-800 rounded-lg text-white" />
          </div>
          <div>
            <label className="text-slate-400 block mb-1">{t('dataforseo.passwordLabel')}</label>
            <input type="password" value={dataforseoPass} onChange={(e) => setDataforseoPass(e.target.value)} placeholder={hint(dataForSeoStored.password, t('dataforseo.passwordPlaceholder'))} className="w-full h-9 px-3 bg-slate-900 border border-slate-800 rounded-lg text-white" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button type="button" onClick={() => handleTestDataForSeo()} disabled={testingDataForSeo} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60">
            {testingDataForSeo && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {testingDataForSeo ? t('dataforseo.testingConnection') : t('dataforseo.testConnection')}
          </button>
          {dataForSeoTestStatus && <p className="text-[11px] leading-4 text-slate-400">{dataForSeoTestStatus}</p>}
        </div>
        <DataForSeoBudgetSettings />
      </div>

      <div className="space-y-3 p-4 bg-slate-950/80 rounded-xl border border-slate-800">
        <h4 className="font-bold text-white">{t('legacyUi.settings.pagespeed')}</h4>
        <p className="text-[11px] leading-5 text-slate-400">{t('legacyUi.settings.googleDescription')}</p>
        <div>
          <label className="text-slate-400 block mb-1">{t('legacyUi.settings.googleApiKey')}</label>
          <input type="password" value={googleMetricsKey} onChange={(e) => setGoogleMetricsKey(e.target.value)} placeholder={hint(googleKeyStored, t('legacyUi.settings.googlePlaceholder'))} autoComplete="new-password" className="w-full h-9 px-3 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono" />
        </div>
      </div>

      <div className="space-y-3 p-4 bg-slate-950/80 rounded-xl border border-slate-800">
        <h4 className="font-bold text-white">{t('legacyUi.settings.aiProviderKeys')}</h4>
        <div className="space-y-2">
          {(['openai', 'claude', 'gemini'] as const).map((provider) => (
            <div key={provider}>
              <label htmlFor={`settings-${provider}-api-key`} className="text-slate-400 block mb-1">{t(`legacyUi.settings.${provider}ApiKey`)}</label>
              <SecretKeyField id={`settings-${provider}-api-key`} label={t(`legacyUi.settings.${provider}ApiKey`)} stored={Boolean(apiKeys[provider].trim())} onSave={(value) => handleAiKeyChange(provider, value)} inputClassName="h-9 min-w-0 flex-1 px-3 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono" />
            </div>
          ))}
        </div>
      </div>

      {/* Live project LLM ledger: shows live usage or empty state, never fictitious costs. */}
      <LlmEconomyBudgetSettings />
      <LlmEconomyPanel projectId={activeProjectId} providerId={activeProvider} />

      {secureStorageError &&<p role="alert" className="text-[11px] leading-4 text-rose-300">{secureStorageError}</p>}
      <button type="button" onClick={handleSaveGeneral} disabled={isSaving} aria-busy={isSaving} className="w-full h-9 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-60">
        {savedSuccess ? t('legacyUi.settings.saved') : t('legacyUi.settings.saveApi')}
      </button>
    </div>
  );
};
