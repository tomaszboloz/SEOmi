import type { CrawlFilterValidationError, CrawlFilterValidationResult } from '@/types';
import i18n from '@/i18n';

export function validateBrowserCrawlFilters(args?: Record<string, unknown>): Promise<CrawlFilterValidationResult> {
  const includePatterns = Array.isArray(args?.includePatterns)
    ? args.includePatterns.filter((value): value is string => typeof value === 'string')
    : [];
  const excludePatterns = Array.isArray(args?.excludePatterns)
    ? args.excludePatterns.filter((value): value is string => typeof value === 'string')
    : [];
  const previewUrls = Array.isArray(args?.previewUrls)
    ? args.previewUrls.filter((value): value is string => typeof value === 'string').filter((value) => value.trim()).slice(0, 500)
    : [];
  const errors: CrawlFilterValidationError[] = [];
  const compile = (patterns: string[], filter: 'include' | 'exclude'): RegExp[] => patterns.flatMap((pattern) => {
    if ([...pattern].length > 2048) {
      errors.push({ filter, pattern, message: i18n.t('runtimeErrors.tauri.patternTooLong') });
      return [];
    }
    try {
      return [new RegExp(pattern)];
    } catch (error) {
      errors.push({ filter, pattern, message: error instanceof Error ? error.message : i18n.t('runtimeErrors.tauri.invalidRegex') });
      return [];
    }
  });
  const include = compile(includePatterns, 'include');
  const exclude = compile(excludePatterns, 'exclude');
  if (errors.length) return Promise.resolve({ valid: false, errors, previews: [] });
  const previews = previewUrls.map((url) => {
    const includedByInclude = include.length === 0 || include.some((pattern) => pattern.test(url));
    const excludedByExclude = exclude.some((pattern) => pattern.test(url));
    return !includedByInclude
      ? { url, included: false, reason: i18n.t('runtimeErrors.tauri.notIncluded') }
      : excludedByExclude
        ? { url, included: false, reason: i18n.t('runtimeErrors.tauri.excluded') }
        : { url, included: true, reason: i18n.t('runtimeErrors.tauri.accepted') };
  });
  return Promise.resolve({ valid: true, errors: [], previews } satisfies CrawlFilterValidationResult);
}
