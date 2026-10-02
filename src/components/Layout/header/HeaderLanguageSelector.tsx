import { useEffect, useRef, useState } from 'react';
import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/stores/settingsStore';
import { LANGUAGES } from '@/i18n';

export const HeaderLanguageSelector = () => {
  const { t } = useTranslation();
  const language = useSettingsStore(s => s.language);
  const setLanguage = useSettingsStore(s => s.setLanguage);
  const [languageOpen, setLanguageOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!languageOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!languageMenuRef.current?.contains(event.target as Node)) {
        setLanguageOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLanguageOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
  return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [languageOpen]);

  return (
        <div ref={languageMenuRef} className="relative">
          <button
            type="button"
            aria-label={t('settings.language')}
            aria-haspopup="menu"
            aria-expanded={languageOpen}
            onClick={() => setLanguageOpen((open) => !open)}
            className="flex items-center space-x-1 p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-md transition text-xs"
            title={t('settings.language')}
          >
            <Globe className="w-4 h-4" />
            <span className="uppercase font-mono text-[11px]">{language}</span>
          </button>
          <div
            role="menu"
            aria-label={t('settings.language')}
            className={`absolute right-0 mt-1 w-44 bg-slate-900 border border-slate-800 rounded-lg shadow-xl py-1 transition-all duration-150 z-50 max-h-72 overflow-y-auto ${languageOpen ? 'visible opacity-100' : 'invisible pointer-events-none opacity-0'}`}
          >
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                role="menuitem"
                onClick={() => {
                  setLanguage(l.code);
                  setLanguageOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-800 transition ${
                  language === l.code ? 'text-emerald-400 font-semibold bg-emerald-500/5' : 'text-slate-300'
                }`}
              >
                <span>{l.nativeName}</span>
                <span className="text-[10px] text-slate-400 font-mono uppercase">{l.code}</span>
              </button>
            ))}
          </div>
        </div>

  );
};
