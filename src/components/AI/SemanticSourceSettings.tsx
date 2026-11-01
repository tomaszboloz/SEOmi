import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loadSemanticSet, readSemanticSettings, saveSemanticSettings, isSemanticSettings, type SemanticSettings } from '@/services/semanticSource';

const field = 'h-9 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 text-white';
const button = 'inline-flex h-8 items-center rounded-lg px-3 font-semibold text-white';
const DEFAULT_URL = ['http://127.0.0.1', '11434'].join(':');
const PROBE = [{ url: 'https://probe.invalid/', title: 'SEOmi connection probe' }];

export interface SemanticSourceSettingsProps { load?: typeof loadSemanticSet }

/** Optional Ollama embeddings for Site Focus and Topical Authority (#86). Off by default; TF-IDF stays the fallback. */
export const SemanticSourceSettings: React.FC<SemanticSourceSettingsProps> = ({ load = loadSemanticSet }) => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<SemanticSettings>(readSemanticSettings);
  const [message, setMessage] = useState<string | null>(null);
  const patch = (next: Partial<SemanticSettings>) => setSettings({ ...settings, ...next });
  const num = (value: string) => Number(value.replace(',', '.'));

  const save = () => {
    if (!isSemanticSettings(settings)) { setMessage(t('semanticSource.invalid')); return; }
    setMessage(saveSemanticSettings(settings).ok ? t('semanticSource.saved') : t('semanticSource.failed'));
  };
  const test = async () => {
    setMessage(t('semanticSource.testing'));
    const result = await load({ settings: { ...settings, enabled: true }, projectId: 'probe', pages: PROBE });
    if (result.status === 'ready') setMessage(t('semanticSource.testOk', { model: result.set.model, dimensions: result.set.dimensions }));
    else setMessage(t('semanticSource.testFail', { reason: t(`semanticSource.reason.${result.status === 'fallback' && result.error ? result.error.code : 'failed'}`) }));
  };

  return (
    <section aria-labelledby="semantic-source-title" className="space-y-2 border-t border-slate-800 pt-3 text-sm" data-testid="semantic-source">
      <h5 id="semantic-source-title" className="font-semibold text-white">{t('semanticSource.title')}</h5>
      <p className="text-[11px] text-slate-400">{t('semanticSource.hint')}</p>
      <label className="flex items-center gap-2 text-slate-200">
        <input type="checkbox" checked={settings.enabled} onChange={(event) => patch({ enabled: event.target.checked })} />
        {t('semanticSource.enable')}
      </label>
      <label className="block text-slate-400">{t('semanticSource.provider')}
        <select value={settings.provider} onChange={(event) => patch({ provider: event.target.value as SemanticSettings['provider'] })} className={`${field} mt-1`}>
          <option value="ollama">{t('semanticSource.providerOllama')}</option>
          <option value="hybrid">{t('semanticSource.providerHybrid')}</option>
        </select>
      </label>
      <label className="block text-slate-400">{t('semanticSource.url')}
        <input value={settings.ollamaUrl} placeholder={DEFAULT_URL} onChange={(event) => patch({ ollamaUrl: event.target.value })} className={`${field} mt-1`} />
      </label>
      <label className="block text-slate-400">{t('semanticSource.model')}
        <input value={settings.model} onChange={(event) => patch({ model: event.target.value })} className={`${field} mt-1`} />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-slate-400">{t('semanticSource.timeout')}
          <input inputMode="numeric" value={settings.timeoutMs} onChange={(event) => patch({ timeoutMs: num(event.target.value) })} className={`${field} mt-1`} />
        </label>
        <label className="block text-slate-400">{t('semanticSource.maxEntries')}
          <input inputMode="numeric" value={settings.maxEntries} onChange={(event) => patch({ maxEntries: num(event.target.value) })} className={`${field} mt-1`} />
        </label>
      </div>
      <div className="flex gap-2">
        <button type="button" className={`${button} bg-emerald-600`} onClick={save}>{t('semanticSource.save')}</button>
        <button type="button" className={`${button} bg-slate-700`} onClick={() => { void test(); }}>{t('semanticSource.test')}</button>
      </div>
      {message && <p role="status" className="text-[11px] text-slate-300">{message}</p>}
    </section>
  );
};
