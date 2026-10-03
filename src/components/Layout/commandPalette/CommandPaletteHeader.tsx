import React from 'react';
import { Search, X } from 'lucide-react';
import type { TFunction } from 'i18next';

interface CommandPaletteHeaderProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
  query: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  t: TFunction;
}

export const CommandPaletteHeader: React.FC<CommandPaletteHeaderProps> = ({
  inputRef,
  query,
  onQueryChange,
  onClose,
  t,
}) => {
  return (
    <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
      <Search className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
      <h2 id="command-palette-title" className="sr-only">
        {t('commandPalette.title')}
      </h2>
      <input
        ref={inputRef}
        value={query}
        onChange={(event) => onQueryChange(event.target.value.slice(0, 120))}
        aria-label={t('commandPalette.searchLabel')}
        placeholder={t('commandPalette.searchPlaceholder')}
        className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
      />
      <kbd className="hidden rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-500 sm:inline">
        {t('commandPalette.escape')}
      </kbd>
      <button
        type="button"
        onClick={onClose}
        aria-label={t('commandPalette.close')}
        className="rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
};
