import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import {
  DATAFORSEO_MARKETS,
  DataForSeoMarket,
  dataForSeoMarketLabel,
} from '@/services/dataforseo';
import {
  DataForSeoLocationPickerProps,
  filterAndSortLocationOptions,
  inputClasses,
  optionId,
  pickerClasses,
  selectInputText,
  useDismiss,
} from './pickerPrimitives';
import { handlePickerKeyboardNav } from './pickerKeyboardNav';
import { PickerMenu } from './PickerMenu';
import { LocationOptionButton } from './LocationOptionButton';

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
  const market = markets.find(
    (item) => item.code === value || String(item.locationCode) === value,
  );
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!market) {
      setQuery('');
      return;
    }
    setQuery((current) =>
      /^\d+$/.test(current.trim())
        ? String(market.locationCode)
        : `${dataForSeoMarketLabel(market)} (${market.code})`,
    );
  }, [market]);

  const options = useMemo(
    () => filterAndSortLocationOptions(markets, market, query),
    [market, markets, query],
  );

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
        aria-activedescendant={
          open && options[activeIndex] ? optionId(listId, activeIndex) : undefined
        }
        value={query}
        placeholder={placeholder}
        disabled={disabled}
        className={inputClasses}
        onFocus={() => {
          setOpen(true);
          setActiveIndex(0);
          selectInputText(inputRef.current);
        }}
        onChange={(event) => {
          const nextQuery = event.target.value;
          setQuery(nextQuery);
          setOpen(true);
          setActiveIndex(0);
          const exact = markets.find((i) => String(i.locationCode) === nextQuery.trim());
          if (exact) onChange(String(exact.locationCode));
        }}
        onBlur={() => {
          const sel = markets.find(
            (i) => i.code === value || String(i.locationCode) === value,
          );
          if (sel) setQuery(`${dataForSeoMarketLabel(sel)} (${sel.code})`);
        }}
        onKeyDown={(e) =>
          handlePickerKeyboardNav(e, setOpen, setActiveIndex, options.length, () => {
            if (options[activeIndex]) choose(options[activeIndex]);
          })
        }
      />
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
      />
      {open && (
        <PickerMenu listId={listId} ariaLabel={ariaLabel} isEmpty={!options.length}>
          {options.map((item, index) => (
            <LocationOptionButton
              key={`${item.code}-${item.locationCode}`}
              item={item}
              id={optionId(listId, index)}
              isSelected={item.code === value || String(item.locationCode) === value}
              isActive={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(item)}
            />
          ))}
        </PickerMenu>
      )}
    </div>
  );
};
