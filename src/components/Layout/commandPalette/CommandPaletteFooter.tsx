import React from 'react';
import { Keyboard } from 'lucide-react';
import type { TFunction } from 'i18next';

interface CommandPaletteFooterProps {
  count: number;
  t: TFunction;
}

export const CommandPaletteFooter: React.FC<CommandPaletteFooterProps> = ({ count, t }) => {
  return (
    <div className="flex items-center justify-between border-t border-slate-800 px-4 py-2 text-[10px] text-slate-500">
      <span>
        <Keyboard className="mr-1 inline h-3 w-3" aria-hidden="true" />
        {t('commandPalette.keyboardHelp')}
      </span>
      <span>{t('commandPalette.itemsCount', { count })}</span>
    </div>
  );
};
