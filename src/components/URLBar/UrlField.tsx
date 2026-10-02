import React from 'react';
import { useTranslation } from 'react-i18next';
import { Clipboard, Globe, Loader2 } from 'lucide-react';

interface UrlFieldProps {
  url: string;
  isLoading: boolean;
  updateUrl: (value: string) => void;
}

export const UrlField: React.FC<UrlFieldProps> = ({ url, isLoading, updateUrl }) => {
  const { t } = useTranslation();

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        // Keep paste consistent with typing: the active project's draft must
        // survive a project switch or app restart as well.
        updateUrl(text.trim());
      }
    } catch {
      // Clipboard read permission declined
    }
  };

  return (
    <div className="relative flex-1 flex items-center">
      <div className="absolute left-3 text-slate-400 pointer-events-none flex items-center">
        {isLoading ? (
          <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
        ) : (
          <Globe className="w-4 h-4 text-slate-400" />
        )}
      </div>

      <input
        id="url-input-field"
        aria-label={t('legacyUi.url.urlAria')}
        type="text"
        value={url}
        onChange={(e) => updateUrl(e.target.value)}
        placeholder={t('urlBar.placeholder')}
        disabled={isLoading}
        className="w-full h-10 pl-9 pr-24 bg-slate-900/90 border border-slate-700/80 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition disabled:opacity-60"
        autoComplete="off"
        spellCheck={false}
      />

      {/* Quick paste button inside input */}
      <div className="absolute right-2 flex items-center space-x-1.5">
        <button
          type="button"
          onClick={handlePaste}
          className="px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 rounded border border-slate-700/50 transition flex items-center space-x-1"
          title={t('urlBar.quickPaste')}
        >
          <Clipboard className="w-3 h-3" />
          <span className="hidden sm:inline">{t('urlBar.quickPaste')}</span>
        </button>
        <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] text-slate-400 font-mono bg-slate-800 rounded border border-slate-700">
          {t('uiUnits.openCommandPaletteShortcut')}
        </kbd>
      </div>
    </div>
  );
};
