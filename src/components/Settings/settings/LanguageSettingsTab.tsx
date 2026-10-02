import React from 'react';
import { Check } from 'lucide-react';
import { LANGUAGES } from '@/i18n';
import { useSettingsStore } from '@/stores/settingsStore';

export const LanguageSettingsTab: React.FC = () => {
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);

  return (
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
  );
};
