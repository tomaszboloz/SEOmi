import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  buildTermDictionary, parseTermDictionary, readDictionarySettings, saveDictionarySettings, MAX_USER_TEXT_CHARS,
} from '@/services/llmEconomy';

const box = 'w-full rounded-lg border border-slate-800 bg-slate-900 p-2 text-white';
const button = 'inline-flex h-8 items-center rounded-lg px-3 font-semibold text-white';

/** Optional YMYL term list (#137): MeSH seed (public domain) plus a user-imported list such as ICD-10 or drug names. */
export const YmylDictionarySettings: React.FC<{ now?: () => Date }> = ({ now = () => new Date() }) => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState(readDictionarySettings);
  const [message, setMessage] = useState<string | null>(null);
  const count = buildTermDictionary(settings)?.terms.size ?? 0;

  const persist = (next: typeof settings) => {
    const outcome = saveDictionarySettings(next);
    if (outcome.ok) setSettings(next);
    setMessage(outcome.ok ? t('llmEconomy.dictSaved') : t('llmEconomy.dictFailed'));
  };
  const importText = (text: string, source: string) => {
    const parsed = parseTermDictionary(text, source, '');
    if (!parsed.dictionary) { setMessage(t('llmEconomy.dictEmpty')); return; }
    persist({ ...settings, userText: text.slice(0, MAX_USER_TEXT_CHARS), userSource: source, importedAt: now().toISOString() });
  };
  const onFile = async (file: File | undefined) => { if (file) importText(await file.text(), file.name); };

  return (
    <section aria-labelledby="ymyl-dict-title" className="space-y-2 border-t border-slate-800 pt-3 text-sm" data-testid="ymyl-dictionary">
      <h5 id="ymyl-dict-title" className="font-semibold text-white">{t('llmEconomy.dictTitle')}</h5>
      <p className="text-[11px] text-slate-400">{t('llmEconomy.dictHint')}</p>
      <label className="flex items-center gap-2 text-slate-200">
        <input type="checkbox" checked={settings.useMeshSeed} onChange={(event) => persist({ ...settings, useMeshSeed: event.target.checked })} />
        {t('llmEconomy.dictSeed')}
      </label>
      <label className="block text-slate-400">{t('llmEconomy.dictFile')}
        <input type="file" accept=".txt,.csv,.tsv,text/plain,text/csv" className={`${box} mt-1`} onChange={(event) => { void onFile(event.target.files?.[0]); }} />
      </label>
      <label className="block text-slate-400">{t('llmEconomy.dictPaste')}
        <textarea rows={3} value={settings.userText} className={`${box} mt-1`} onChange={(event) => setSettings({ ...settings, userText: event.target.value })} />
      </label>
      <div className="flex gap-2">
        <button type="button" className={`${button} bg-emerald-600`} onClick={() => importText(settings.userText, settings.userSource || t('llmEconomy.dictPasted'))}>{t('llmEconomy.dictSave')}</button>
        <button type="button" className={`${button} bg-slate-700`} onClick={() => persist({ ...settings, userText: '', userSource: '', importedAt: null })}>{t('llmEconomy.dictClear')}</button>
      </div>
      <p className="text-[11px] text-slate-300">{t('llmEconomy.dictCount', { count })}</p>
      {message && <p role="status" className="text-[11px] text-slate-300">{message}</p>}
    </section>
  );
};
