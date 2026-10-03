import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { PaletteItem } from './commandPaletteTypes';

interface CommandPaletteListProps {
  filteredItems: PaletteItem[];
  activeIndex: number;
  activeOptionRef: React.RefObject<HTMLButtonElement | null>;
  activeProjectId: string | null;
  onSelectIndex: (index: number) => void;
  t: TFunction;
}

export const CommandPaletteList: React.FC<CommandPaletteListProps> = ({
  filteredItems,
  activeIndex,
  activeOptionRef,
  activeProjectId,
  onSelectIndex,
  t,
}) => {
  return (
    <div
      className="max-h-[55vh] overflow-y-auto p-2"
      role="listbox"
      aria-label={t('commandPalette.results')}
      aria-activedescendant={
        filteredItems[activeIndex] ? `command-palette-option-${filteredItems[activeIndex].id}` : undefined
      }
    >
      {filteredItems.length === 0 ? (
        <p className="px-3 py-10 text-center text-sm text-slate-500">{t('commandPalette.noResults')}</p>
      ) : (
        filteredItems.map((item, index) => {
          const Icon = item.icon;
          const selected = index === activeIndex;
          return (
            <button
              key={item.id}
              id={`command-palette-option-${item.id}`}
              ref={selected ? activeOptionRef : undefined}
              type="button"
              role="option"
              aria-selected={selected}
              onMouseEnter={() => onSelectIndex(index)}
              onClick={item.action}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                selected ? 'bg-emerald-400/10 text-emerald-100' : 'text-slate-300 hover:bg-slate-800/80'
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${selected ? 'text-emerald-400' : 'text-slate-500'}`}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{item.label}</span>
                <span className="block truncate text-[10px] text-slate-500">{item.group}</span>
              </span>
              {item.id === `project:${activeProjectId}` && (
                <span className="text-[10px] text-emerald-400">{t('commandPalette.active')}</span>
              )}
              {selected && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />}
            </button>
          );
        })
      )}
    </div>
  );
};
