import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import en from '../../src/i18n/locales/en.json';
import pl from '../../src/i18n/locales/pl.json';
import es from '../../src/i18n/locales/es.json';
import de from '../../src/i18n/locales/de.json';
import fr from '../../src/i18n/locales/fr.json';
import itLocale from '../../src/i18n/locales/it.json';
import pt from '../../src/i18n/locales/pt.json';
import ru from '../../src/i18n/locales/ru.json';
import ja from '../../src/i18n/locales/ja.json';
import zh from '../../src/i18n/locales/zh.json';
import ko from '../../src/i18n/locales/ko.json';
import ar from '../../src/i18n/locales/ar.json';

export const flattenKeys = (value: unknown, prefix = ''): string[] => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return prefix ? [prefix] : [];
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return flattenKeys(child, path);
    });
  };

export const locales = [
    { code: 'en', data: en },
    { code: 'pl', data: pl },
    { code: 'es', data: es },
    { code: 'de', data: de },
    { code: 'fr', data: fr },
    { code: 'it', data: itLocale },
    { code: 'pt', data: pt },
    { code: 'ru', data: ru },
    { code: 'ja', data: ja },
    { code: 'zh', data: zh },
    { code: 'ko', data: ko },
    { code: 'ar', data: ar },
  ];

export const placeholders = (value: unknown): string[] => typeof value === 'string'
    ? [...value.matchAll(/{{\s*([^}]+?)\s*}}/g)].map((match) => match[1]).sort()
    : [];

export const readLeaf = (value: unknown, key: string): unknown => key.split('.').reduce(
    (current, part) => (current as Record<string, unknown>)[part], value,
  );

export const englishKeys = flattenKeys(en).sort();

export const englishPlaceholders = new Map(englishKeys.map(key => [key, placeholders(readLeaf(en, key))]));

export const sourceFiles: string[] = [];

export const collectSourceFiles = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const absolute = join(directory, entry);
      if (statSync(absolute).isDirectory()) collectSourceFiles(absolute);
      else if (/\.(ts|tsx)$/.test(absolute) && !absolute.endsWith('.d.ts')) sourceFiles.push(absolute);
    }
  };

collectSourceFiles(join(process.cwd(), 'src'));
