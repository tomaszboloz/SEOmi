import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import {
  DATAFORSEO_MARKETS,
  DataForSeoMarket,
  dataForSeoLanguageLabel,
  dataForSeoMarketLabel,
} from '@/services/dataforseo';

interface BasePickerProps {
  ariaLabel: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export interface DataForSeoLocationPickerProps extends BasePickerProps {
  value: string;
  onChange: (countryCode: string) => void;
  markets?: DataForSeoMarket[];
}

export interface DataForSeoLanguagePickerProps extends BasePickerProps {
  value: string;
  onChange: (languageCode: string) => void;
  market?: DataForSeoMarket;
}

const normalize = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLocaleLowerCase();

const pickerSort = (query: string, left: string[], right: string[]): number => {
  const normalizedQuery = normalize(query);
  if (normalizedQuery) {
    const leftExact = left.some((value) => normalize(value) === normalizedQuery) ? 0 : 1;
    const rightExact = right.some((value) => normalize(value) === normalizedQuery) ? 0 : 1;
    if (leftExact !== rightExact) return leftExact - rightExact;

    const leftStarts = left.some((value) => normalize(value).startsWith(normalizedQuery)) ? 0 : 1;
    const rightStarts = right.some((value) => normalize(value).startsWith(normalizedQuery)) ? 0 : 1;
    if (leftStarts !== rightStarts) return leftStarts - rightStarts;
  }

  return left[0].localeCompare(right[0], undefined, { sensitivity: 'base', numeric: true });
};

const pickerClasses = (className = '') => `relative min-w-48 ${className}`;
const inputClasses = 'h-9 w-full rounded-lg border border-slate-700 bg-slate-950 pl-8 pr-8 text-xs text-slate-200 outline-none transition focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60';
const menuClasses = 'absolute left-0 top-full z-[80] mt-1 max-h-64 w-full min-w-[15rem] overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-2xl';

const optionId = (listId: string, index: number): string => `${listId}-option-${index}`;

const selectInputText = (input: HTMLInputElement | null): void => {
  // Selecting the current label makes the first typed character replace it,
  // which is the expected combobox workflow for long provider catalogues.
  input?.select();
};

const useDismiss = (open: boolean, close: () => void, rootRef: React.RefObject<HTMLDivElement | null>) => {
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [close, open, rootRef]);
};

export const DataForSeoLocationPicker: React.FC<DataForSeoLocationPickerProps> = ({
  value,
  onChange,
  markets = DATAFORSEO_MARKETS,
  ariaLabel,
  disabled = false,
  placeholder = ariaLabel,
  className,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const market = markets.find((item) => item.code === value || String(item.locationCode) === value) || markets[0];
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!market) {
      setQuery('');
      return;
    }
    setQuery((current) => /^\d+$/.test(current.trim()) ? String(market.locationCode) : `${dataForSeoMarketLabel(market)} (${market.code})`);
  }, [market]);

  const options = useMemo(() => {
    const normalizedQuery = normalize(query);
    const filtered = markets.filter((item) => {
      if (!normalizedQuery || normalizedQuery === normalize(`${dataForSeoMarketLabel(market)} (${market?.code})`)) return true;
      const haystack = normalize(`${dataForSeoMarketLabel(item)} ${item.label} ${item.code} ${item.locationCode}`);
      return haystack.includes(normalizedQuery);
    });
    return [...filtered].sort((left, right) => pickerSort(
      normalizedQuery,
      [dataForSeoMarketLabel(left), left.label, left.code, String(left.locationCode)],
      [dataForSeoMarketLabel(right), right.label, right.code, String(right.locationCode)],
    ));
  }, [market, markets, query]);

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(0, options.length - 1)));
  }, [options.length]);

  useDismiss(open, () => setOpen(false), rootRef);

  const choose = (next: DataForSeoMarket) => {
    onChange(next.code);
    setQuery(`${dataForSeoMarketLabel(next)} (${next.code})`);
    setActiveIndex(0);
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, Math.max(0, options.length - 1)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(Math.max(0, options.length - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (options[activeIndex]) choose(options[activeIndex]);
    }
  };

  return (
    <div ref={rootRef} className={pickerClasses(className)}>
      <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && options[activeIndex] ? optionId(listId, activeIndex) : undefined}
        value={query}
        placeholder={placeholder}
        disabled={disabled}
        className={inputClasses}
        onFocus={() => { setOpen(true); setActiveIndex(0); selectInputText(inputRef.current); }}
        onChange={(event) => {
          const nextQuery = event.target.value;
          setQuery(nextQuery);
          setOpen(true);
          setActiveIndex(0);
          // Keep old location-code deep links and automation clients
          // compatible while the visible control remains searchable.
          const exactLocation = markets.find((item) => String(item.locationCode) === nextQuery.trim());
          if (exactLocation) onChange(String(exactLocation.locationCode));
        }}
        onBlur={() => {
          // Free text is only a filter. A paid request may use a catalogue
          // value after the user picks an option, never the last typed label.
          const selectedMarket = markets.find((item) => item.code === value || String(item.locationCode) === value) || markets[0];
          if (selectedMarket) setQuery(`${dataForSeoMarketLabel(selectedMarket)} (${selectedMarket.code})`);
        }}
        onKeyDown={handleKeyDown}
      />
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
      {open && (
        <div id={listId} role="listbox" aria-label={ariaLabel} className={menuClasses}>
          {options.map((item, index) => (
            <button
              key={`${item.code}-${item.locationCode}`}
              id={optionId(listId, index)}
              type="button"
              role="option"
              aria-selected={item.code === value || String(item.locationCode) === value}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition ${index === activeIndex ? 'bg-emerald-500/10 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(item)}
            >
              <span className="truncate">
                {dataForSeoMarketLabel(item)} <span className="text-slate-500">({item.code}) · {item.locationCode}</span>
              </span>
              {item.code === value || String(item.locationCode) === value ? <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-emerald-400" /> : null}
            </button>
          ))}
          {!options.length ? <div className="px-3 py-2 text-xs text-slate-500">—</div> : null}
        </div>
      )}
    </div>
  );
};

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
  const selected = languages.find((item) => item.code === value) || languages[0];

  useEffect(() => {
    setQuery(selected ? `${dataForSeoLanguageLabel(selected)} (${selected.code})` : '');
    setActiveIndex(0);
  }, [selected]);

  const options = useMemo(() => {
    const normalizedQuery = normalize(query);
    const filtered = languages.filter((item) => {
      if (!normalizedQuery || normalizedQuery === normalize(`${dataForSeoLanguageLabel(selected)} (${selected?.code})`)) return true;
      return normalize(`${dataForSeoLanguageLabel(item)} ${item.label} ${item.code}`).includes(normalizedQuery);
    });
    return [...filtered].sort((left, right) => pickerSort(
      normalizedQuery,
      [dataForSeoLanguageLabel(left), left.label, left.code],
      [dataForSeoLanguageLabel(right), right.label, right.code],
    ));
  }, [languages, query, selected]);

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
      <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
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
        onFocus={() => { setOpen(true); setActiveIndex(0); selectInputText(inputRef.current); }}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); setActiveIndex(0); }}
        onBlur={() => {
          const selectedLanguage = languages.find((item) => item.code === value) || languages[0];
          if (selectedLanguage) setQuery(`${dataForSeoLanguageLabel(selectedLanguage)} (${selectedLanguage.code})`);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.min(index + 1, Math.max(0, options.length - 1))); }
          else if (event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.max(0, index - 1)); }
          else if (event.key === 'Home') { event.preventDefault(); setOpen(true); setActiveIndex(0); }
          else if (event.key === 'End') { event.preventDefault(); setOpen(true); setActiveIndex(Math.max(0, options.length - 1)); }
          else if (event.key === 'Enter') { event.preventDefault(); if (options[activeIndex]) choose(options[activeIndex]); }
        }}
        aria-activedescendant={open && options[activeIndex] ? optionId(listId, activeIndex) : undefined}
      />
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
      {open && (
        <div id={listId} role="listbox" aria-label={ariaLabel} className={menuClasses}>
          {options.map((item, index) => (
            <button
              key={item.code}
              id={optionId(listId, index)}
              type="button"
              role="option"
              aria-selected={item.code === value}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition ${index === activeIndex ? 'bg-emerald-500/10 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(item)}
            >
              <span className="truncate">{dataForSeoLanguageLabel(item)} <span className="text-slate-500">({item.code})</span></span>
              {item.code === value ? <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-emerald-400" /> : null}
            </button>
          ))}
          {!options.length ? <div className="px-3 py-2 text-xs text-slate-500">—</div> : null}
        </div>
      )}
    </div>
  );
};
