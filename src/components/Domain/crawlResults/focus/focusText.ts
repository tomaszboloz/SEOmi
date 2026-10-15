import type { TFunction } from 'i18next';
import type { CodeParams } from '@/services/siteFocus/types';

/** Resolves an engine code to localized copy. Missing keys fall back to the code itself. */
export const codeText = (t: TFunction, group: string, code: string, params: CodeParams = {}): string =>
  t(`focus.${group}.${code}`, { ...params, defaultValue: code });

export const codeTitle = (t: TFunction, group: string, code: string, params: CodeParams = {}): string =>
  t(`focus.${group}.${code}.title`, { ...params, defaultValue: code });

export const codeDetail = (t: TFunction, group: string, code: string, params: CodeParams = {}): string =>
  t(`focus.${group}.${code}.detail`, { ...params, defaultValue: '' });

export const formatPct = (value: number): string => `${Math.round(value * 10) / 10}`;
