import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import ts from 'typescript';
import { LANGUAGES, languageReady, loadLocale } from '../src/i18n';
import i18n from '../src/i18n';
import en from '../src/i18n/locales/en.json';
import pl from '../src/i18n/locales/pl.json';

import { flattenKeys, locales, placeholders, readLeaf, englishKeys, englishPlaceholders, sourceFiles } from "./fixtures/i18nContracts";

describe('i18n multi-language support', () => {

it('should support exactly 12 configured languages', () => {
    expect(LANGUAGES.length).toBe(12);
  });

it('waits for the persisted locale before mounting the initial UI', async () => {
    await languageReady;
    expect(document.documentElement.lang).toBe(i18n.language);
  });

it('all 12 locales should contain app.name and app.tagline', () => {
    for (const loc of locales) {
      expect(loc.data.app?.name, `Failed on ${loc.code}`).toBe('SEOmi');
      expect(loc.data.app?.tagline?.length, `Failed on ${loc.code}`).toBeGreaterThan(0);
    }
  });

it('all 12 locales should contain sidebar navigation keys', () => {
    const requiredSidebarKeys = [
      'overview',
      'social',
      'headings',
      'metadata',
      'images',
      'links',
      'security',
      'performance',
      'settings',
    ];

    for (const loc of locales) {
      for (const key of requiredSidebarKeys) {
        expect(
          (loc.data.sidebar as any)?.[key],
          `Missing sidebar.${key} in ${loc.code}`
        ).toBeDefined();
      }
    }
  });

it('all runtime locale resources expose the complete workflow namespaces', async () => {
    for (const loc of locales) {
      const translation = await loadLocale(loc.code);
      expect((translation as any).siteAudit?.title, `Missing siteAudit.title in runtime ${loc.code}`).toBeDefined();
      expect((translation as any).mcp?.clientConfig, `Missing mcp.clientConfig in runtime ${loc.code}`).toBeDefined();
    }
  });

it('keeps every runtime locale structurally aligned with English', async () => {
      const expected = flattenKeys(en).sort();
      for (const loc of locales) {
        const actual = flattenKeys(await loadLocale(loc.code)).sort();
      const actualSet = new Set(actual);
      const missing = expected.filter((key) => !actualSet.has(key));
      expect(missing, `Locale ${loc.code} is missing runtime keys`).toEqual([]);
  }
  });

it.each(locales)('keeps source locale $code aligned and preserves interpolation variables', ({code, data}) => {
    const actual = flattenKeys(data).sort();
    expect(actual, `Locale ${code} source keys differ from English`).toEqual(englishKeys);

    const mismatches: Array<{key:string; expected:string[]; actual:string[]}> = [];
    const emptyValues: string[] = [];
    for (const key of englishKeys) {
      const leaf = readLeaf(data, key);
      const expectedVariables = englishPlaceholders.get(key)!;
      const actualVariables = placeholders(leaf);
      if (actualVariables.length !== expectedVariables.length || actualVariables.some((variable, index) => variable !== expectedVariables[index])) {
        mismatches.push({key, expected:expectedVariables, actual:actualVariables});
      }
      if (leaf === '') emptyValues.push(key);
    }
    expect(mismatches, `Locale ${code} changed interpolation variables`).toEqual([]);
    expect(emptyValues, `Locale ${code} has empty translations`).toEqual([]);
  });

it('does not leak Polish audit-check labels into other locales', () => {
    const readLeaf = (value: unknown, path: string): unknown => path.split('.').reduce(
      (current, segment) => (current as Record<string, unknown>)?.[segment],
      value,
    );
    const technicalToken = /^[A-Za-z0-9_:-]+(?:[=/.][A-Za-z0-9_:-]+)*$/;
    const auditCheckKeys = flattenKeys(en).filter((key) => (
      key === 'auditChecks.categories.nagOwki'
      || key === 'auditChecks.categories.httpIUrl'
      || key.startsWith('auditChecks.labels.')
    ));
    for (const loc of locales.filter(({ code }) => code !== 'en' && code !== 'pl')) {
      const leaked = auditCheckKeys.filter((key) => {
        const englishValue = readLeaf(en, key);
        const polishValue = readLeaf(pl, key);
        const localizedValue = readLeaf(loc.data, key);
        return typeof polishValue === 'string'
          && polishValue !== englishValue
          && !technicalToken.test(polishValue)
          && localizedValue === polishValue;
      });
      expect(leaked, `Polish audit-check labels leaked into ${loc.code}`).toEqual([]);
    }
  });

it.each(sourceFiles)('backs static translation calls with English keys in %s', (file) => {
    const source = readFileSync(file, 'utf8');
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const missing: Array<{line:number; key:string}> = [];
    const keys = new Set(englishKeys);
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && node.arguments.length > 0) {
        const callee = node.expression.getText(parsed);
        const firstArgument = node.arguments[0];
        // Runtime-assembled keys cannot be validated by this static check.
        if ((callee === 't' || callee === 'i18n.t' || callee.endsWith('.t'))
          && (ts.isStringLiteral(firstArgument) || ts.isNoSubstitutionTemplateLiteral(firstArgument))) {
          const key = firstArgument.text;
          if (!keys.has(key) && !keys.has(`${key}_one`) && !keys.has(`${key}_other`)) {
            missing.push({line:parsed.getLineAndCharacterOfPosition(firstArgument.getStart()).line + 1,key});
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(parsed);
    expect(missing, `Missing English translation keys in ${file}`).toEqual([]);
  });

it('localizes the interrupted-crawl workflow in every non-English locale', () => {
    const workflowKeys = ['interruptedTitle', 'interruptedDescription', 'resumeCrawl', 'discard'];
    for (const loc of locales.filter(({ code }) => code !== 'en')) {
      for (const key of workflowKeys) {
        expect((loc.data.siteAudit as any)?.[key], `Missing siteAudit.${key} in ${loc.code}`).toBeDefined();
        expect((loc.data.siteAudit as any)?.[key], `English fallback remained for siteAudit.${key} in ${loc.code}`).not.toBe((en.siteAudit as any)[key]);
      }
    }
  });
});
