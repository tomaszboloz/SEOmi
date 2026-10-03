import React, { useEffect } from 'react';
import {
  type DataForSeoMarket,
  dataForSeoMarketLabel,
  dataForSeoLanguageLabel,
} from '@/services/dataforseo';

export interface BasePickerProps {
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

export const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase();

export const pickerSort = (
  query: string,
  left: string[],
  right: string[],
): number => {
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

export const pickerClasses = (className = '') => `relative min-w-48 ${className}`;
export const inputClasses =
  'h-9 w-full rounded-lg border border-slate-700 bg-slate-950 pl-8 pr-8 text-xs text-slate-200 outline-none transition focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60';
export const menuClasses =
  'absolute left-0 top-full z-[80] mt-1 max-h-64 w-full min-w-[15rem] overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-2xl';

export const optionId = (listId: string, index: number): string => `${listId}-option-${index}`;

export const selectInputText = (input: HTMLInputElement | null): void => {
  input?.select();
};

export const useDismiss = (
  open: boolean,
  close: () => void,
  rootRef: React.RefObject<HTMLDivElement | null>,
) => {
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

export const filterAndSortLocationOptions = (
  markets: DataForSeoMarket[],
  market: DataForSeoMarket | undefined,
  query: string,
): DataForSeoMarket[] => {
  const normalizedQuery = normalize(query);
  const filtered = markets.filter((item) => {
    const currentLabel = market ? `${dataForSeoMarketLabel(market)} (${market.code})` : '';
    if (!normalizedQuery || normalizedQuery === normalize(currentLabel)) return true;
    const haystack = normalize(
      `${dataForSeoMarketLabel(item)} ${item.label} ${item.code} ${item.locationCode}`,
    );
    return haystack.includes(normalizedQuery);
  });
  return [...filtered].sort((left, right) =>
    pickerSort(
      normalizedQuery,
      [dataForSeoMarketLabel(left), left.label, left.code, String(left.locationCode)],
      [dataForSeoMarketLabel(right), right.label, right.code, String(right.locationCode)],
    ),
  );
};

export const filterAndSortLanguageOptions = (
  languages: { code: string; label: string }[],
  selected: { code: string; label: string } | undefined,
  query: string,
): { code: string; label: string }[] => {
  const normalizedQuery = normalize(query);
  const filtered = languages.filter((item) => {
    const current = selected ? `${dataForSeoLanguageLabel(selected)} (${selected.code})` : '';
    if (!normalizedQuery || normalizedQuery === normalize(current)) return true;
    return normalize(`${dataForSeoLanguageLabel(item)} ${item.label} ${item.code}`).includes(
      normalizedQuery,
    );
  });
  return [...filtered].sort((left, right) =>
    pickerSort(
      normalizedQuery,
      [dataForSeoLanguageLabel(left), left.label, left.code],
      [dataForSeoLanguageLabel(right), right.label, right.code],
    ),
  );
};
