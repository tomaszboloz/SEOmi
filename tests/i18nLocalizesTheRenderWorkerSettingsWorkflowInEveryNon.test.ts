import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { LANGUAGES, setLanguageDirection } from '../src/i18n';
import i18n from '../src/i18n';
import en from '../src/i18n/locales/en.json';

import { flattenKeys, locales } from "./fixtures/i18nContracts";

describe('i18n multi-language support', () => {

it('localizes the render-worker settings workflow in every non-English locale', () => {
    const keys = flattenKeys(en.legacyUi.renderWorker);
    const naturalLanguageKeys = [
      'title',
      'description',
      'sessionExpired',
      'tokenCopyFailed',
      'keepTokenPrivate',
      'activeWithoutToken',
    ];
    for (const loc of locales.filter(({ code }) => code !== 'en')) {
      for (const key of keys) {
        expect(
          (loc.data.legacyUi as any)?.renderWorker?.[key],
          `Missing legacyUi.renderWorker.${key} in ${loc.code}`,
        ).toBeDefined();
        if (naturalLanguageKeys.includes(key)) {
          expect(
            (loc.data.legacyUi as any).renderWorker[key],
            `English render-worker fallback: ${loc.code}.${key}`,
          ).not.toBe((en.legacyUi.renderWorker as any)[key]);
        }
      }
    }
  });

it('does not embed human-readable JSX text outside translation resources', () => {
    const sourceRoot = join(process.cwd(), 'src');
    const files: string[] = [];
    const collect = (directory: string) => {
      for (const entry of readdirSync(directory)) {
        const absolute = join(directory, entry);
        if (statSync(absolute).isDirectory()) collect(absolute);
        else if (absolute.endsWith('.tsx')) files.push(absolute);
      }
    };
    collect(sourceRoot);

    const violations: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node: ts.Node) => {
        if (ts.isJsxText(node)) {
          const text = node.getText().replace(/\s+/g, ' ').trim();
          if (/\p{L}/u.test(text)) {
            const line = parsed.getLineAndCharacterOfPosition(node.getStart()).line + 1;
            violations.push(`${file}:${line}:${text}`);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(parsed);
    }
    expect(violations, 'Move visible JSX text into src/i18n/locales/*.json').toEqual([]);
  });

it('does not embed human-readable JSX labels or hints outside translation resources', () => {
    const sourceRoot = join(process.cwd(), 'src');
    const files: string[] = [];
    const collect = (directory: string) => {
      for (const entry of readdirSync(directory)) {
        const absolute = join(directory, entry);
        if (statSync(absolute).isDirectory()) collect(absolute);
        else if (absolute.endsWith('.tsx')) files.push(absolute);
      }
    };
    collect(sourceRoot);

    // These are the JSX attributes that become visible to users or assistive
    // technology. Technical attributes such as aria-labelledby contain DOM
    // IDs, not copy, and are intentionally excluded.
    const copyAttributes = new Set([
      'alt',
      'aria-description',
      'aria-label',
      'aria-roledescription',
      'aria-valuetext',
      'placeholder',
      'title',
    ]);
    const violations: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node: ts.Node) => {
        if (ts.isJsxAttribute(node) && copyAttributes.has(node.name.getText(parsed))) {
          const initializer = node.initializer;
          if (initializer && ts.isStringLiteral(initializer) && /\p{L}/u.test(initializer.text)) {
            const line = parsed.getLineAndCharacterOfPosition(node.getStart()).line + 1;
            violations.push(`${file}:${line}:${node.name.getText(parsed)}=${initializer.text}`);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(parsed);
    }
    expect(violations, 'Move visible JSX labels, hints and titles into src/i18n/locales/*.json').toEqual([]);
  });

it('should identify Arabic as RTL text direction', () => {
    const arabic = LANGUAGES.find((l) => l.code === 'ar');
    expect(arabic?.dir).toBe('rtl');

    setLanguageDirection('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  });

it('should identify English as LTR text direction', () => {
    const english = LANGUAGES.find((l) => l.code === 'en');
    expect(english?.dir).toBe('ltr');

    setLanguageDirection('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
  });

it('loads a non-English resource on demand before changing the UI language', async () => {
    await i18n.changeLanguage('pl');
    expect(i18n.language).toBe('pl');
    expect(i18n.t('app.name')).toBe('SEOmi');
    expect(i18n.t('sidebar.overview')).toBe('Przegląd');
    await i18n.changeLanguage('en');
  });
});
