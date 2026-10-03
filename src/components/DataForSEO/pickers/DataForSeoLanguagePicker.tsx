import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { dataForSeoLanguageLabel } from '@/services/dataforseo';
import {
  DataForSeoLanguagePickerProps,
  filterAndSortLanguageOptions,
  inputClasses,
  optionId,
  pickerClasses,
  selectInputText,
  useDismiss,
} from './pickerPrimitives';
import { handlePickerKeyboardNav } from './pickerKeyboardNav';
import { PickerMenu } from './PickerMenu';

export const DataForSeoLanguagePicker: React.FC<DataForSeoLanguagePickerProps> = ({
  value,
  onChange,
  market,
  ariaLabel,
  disabled = false,
  placeholder = ariaLabel,
  className,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const languages = market?.languages || [];
  const selected = languages.find((item) => item.code === value);

  useEffect(() => {
    setQuery(selected ? `${dataForSeoLanguageLabel(selected)} (${selected.code})` : '');
    setActiveIndex(0);
  }, [selected]);

  const options = useMemo(
    () => filterAndSortLanguageOptions(languages, selected, query),
    [languages, query, selected],
  );

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(0, options.length - 1)));
  }, [options.length]);

  useDismiss(open, () => setOpen(false), rootRef);

  const choose = (language: { code: string; label: string }) => {
    onChange(language.code);
    setQuery(`${dataForSeoLanguageLabel(language)} (${language.code})`);
    setOpen(false);
    setActiveIndex(0);
  };

  return (
    <div ref={rootRef} className={pickerClasses(className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
      />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        value={query}
        placeholder={placeholder}
        disabled={disabled || !languages.length}
        className={inputClasses}
        onFocus={() => {
          setOpen(true);
          setActiveIndex(0);
          selectInputText(inputRef.current);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onBlur={() => {
          const sel = languages.find((item) => item.code === value);
          if (sel) setQuery(`${dataForSeoLanguageLabel(sel)} (${sel.code})`);
        }}
        onKeyDown={(e) =>
          handlePickerKeyboardNav(e, setOpen, setActiveIndex, options.length, () => {
            if (options[activeIndex]) choose(options[activeIndex]);
          })
        }
        aria-activedescendant={
          open && options[activeIndex] ? optionId(listId, activeIndex) : undefined
        }
      />
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
      />
      {open && (
        <PickerMenu listId={listId} ariaLabel={ariaLabel} isEmpty={!options.length}>
          {options.map((item, index) => (
            <button
              key={item.code}
              id={optionId(listId, index)}
              type="button"
              role="option"
              aria-selected={item.code === value}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition ${
                index === activeIndex
                  ? 'bg-emerald-500/10 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(item)}
            >
              <span className="truncate">
                {dataForSeoLanguageLabel(item)}{' '}
                <span className="text-slate-500">({item.code})</span>
              </span>
              {item.code === value ? (
                <Check
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0 text-emerald-400"
                />
              ) : null}
            </button>
          ))}
        </PickerMenu>
      )}
    </div>
  );
};
