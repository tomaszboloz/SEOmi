import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { LANGUAGES, languageReady, loadLocale, setLanguageDirection } from '../src/i18n';
import i18n from '../src/i18n';
import en from '../src/i18n/locales/en.json';
import pl from '../src/i18n/locales/pl.json';
import es from '../src/i18n/locales/es.json';
import de from '../src/i18n/locales/de.json';
import fr from '../src/i18n/locales/fr.json';
import itLocale from '../src/i18n/locales/it.json';
import pt from '../src/i18n/locales/pt.json';
import ru from '../src/i18n/locales/ru.json';
import ja from '../src/i18n/locales/ja.json';
import zh from '../src/i18n/locales/zh.json';
import ko from '../src/i18n/locales/ko.json';
import ar from '../src/i18n/locales/ar.json';

describe('i18n multi-language support', () => {
  const flattenKeys = (value: unknown, prefix = ''): string[] => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return prefix ? [prefix] : [];
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return flattenKeys(child, path);
    });
  };

  const locales = [
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

  const placeholders = (value: unknown): string[] => typeof value === 'string'
    ? [...value.matchAll(/{{\s*([^}]+?)\s*}}/g)].map((match) => match[1]).sort()
    : [];
  const readLeaf = (value: unknown, key: string): unknown => key.split('.').reduce(
    (current, part) => (current as Record<string, unknown>)[part], value,
  );
  const englishKeys = flattenKeys(en).sort();
  const englishPlaceholders = new Map(englishKeys.map(key => [key, placeholders(readLeaf(en, key))]));

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

  const sourceFiles: string[] = [];
  const collectSourceFiles = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const absolute = join(directory, entry);
      if (statSync(absolute).isDirectory()) collectSourceFiles(absolute);
      else if (/\.(ts|tsx)$/.test(absolute) && !absolute.endsWith('.d.ts')) sourceFiles.push(absolute);
    }
  };
  collectSourceFiles(join(process.cwd(), 'src'));

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

  it('localizes the primary workspace and crawler surfaces in every non-English locale', () => {
    const sidebarKeys = [
      'pageAudit', 'crawlTechnical', 'auditWorkspace', 'keywordWorkflows',
      'domainResearch', 'performanceResearch', 'googleData', 'aiVisibilityGeo',
      'agentWorkflows', 'navigation', 'modules', 'menuSearch',
      'menuSearchPlaceholder', 'clearMenuSearch', 'noMenuResults',
      'menuResultsCount', 'collapseMenu', 'expandMenu', 'connected', 'ready',
      'running', 'connect', 'aiConnectionReady', 'aiConnectionPrompt',
      'overview', 'social', 'headings', 'metadata', 'images', 'links',
      'security', 'structured', 'performance', 'keywordResearch',
      'keywordClustering', 'savedKeywords', 'rankTracking', 'domainOverview',
      'backlinkChecker', 'siteAudit', 'semanticMap', 'aiBrandVisibility',
      'aiSearchPrompts', 'mcpHub', 'workspaceTools', 'newProject',
      'seoTools', 'seoToolsEntry',
      'aiConnection', 'history', 'settings', 'aiAssistant', 'login',
    ];
    const crawlTabKeys = [
      'overview', 'visualisations', 'crawlerReadiness', 'issues', 'content',
      'metadata', 'social', 'structured', 'validation',
    ];
    const siteAuditKeys = [
      'badgeDomainResearch', 'badgeCrawler', 'headerBadge', 'headerCrawler',
      'title', 'description', 'openMap', 'mapRequiresCrawl', 'resultsNavAria', 'resultsCount',
      'resultsLink', 'mapLink', 'fixedNavAria', 'backToResults', 'resultsShort',
      'resultsLong', 'mapDirect', 'mapShort', 'mapLong', 'urlPlaceholder',
      'startUrlAria', 'pageLimitAria', 'pageLimit', 'renderMode',
      'renderModeAria', 'startCrawl', 'filterValidationError', 'historyTitle',
      'historyDescription', 'processedUrls', 'criticalErrors', 'warnings',
      'indexableResponses', 'contentWords',
    ];

    for (const loc of locales.filter(({ code }) => code !== 'en')) {
      for (const key of sidebarKeys) {
        expect((loc.data.sidebar as any)?.[key], `English sidebar fallback: ${loc.code}.${key}`).not.toBe(
          en.sidebar[key as keyof typeof en.sidebar],
        );
      }
      for (const key of crawlTabKeys) {
        expect((loc.data.crawl as any)?.tabs?.[key], `English crawl tab fallback: ${loc.code}.${key}`).not.toBe(
          (en.crawl.tabs as any)[key],
        );
      }
      for (const key of siteAuditKeys) {
        expect((loc.data.siteAudit as any)?.[key], `English site-audit fallback: ${loc.code}.${key}`).not.toBe(
          (en.siteAudit as any)[key],
        );
      }
    }
  });

  it('localizes the high-frequency crawler table labels in every non-English locale', () => {
    const keys = [
      'processedUrls', 'criticalIssues', 'warnings', 'indexable', 'contentWords',
      'address', 'healthScore', 'issues', 'title', 'depth', 'words',
      'complexity', 'readability', 'httpTime', 'redirects', 'noResponse',
      'response', 'finalUrl', 'indexability', 'notDetermined', 'successStatuses',
      'savedHttpValues', 'httpSegment', 'rejectedUrls', 'searchUrlTitle',
    ];
    for (const loc of locales.filter(({ code }) => code !== 'en')) {
      for (const key of keys) {
        expect(
          (loc.data.crawl?.ui as any)?.[key],
          `English crawler-table fallback: ${loc.code}.crawl.ui.${key}`,
        ).not.toBe((en.crawl.ui as any)[key]);
      }
    }
  });

  it('localizes crawler issue diagnostics in every non-English locale', () => {
    const keys = [
      'missingLanguage', 'nofollowMeta', 'nofollowHeader', 'duplicateContent',
      'canonicalElsewhere', 'canonicalConflict', 'multipleCanonical',
      'invalidCanonical', 'thinContent', 'invalidJsonLd', 'clientRedirect',
      'paginationInvalid', 'multipleTitle', 'emptyDescription', 'multipleDescription', 'technicalDetail',
    ];
    for (const loc of locales.filter(({ code }) => code !== 'en')) {
      for (const key of keys) {
        expect(
          (loc.data.crawlIssues as any)?.[key],
          `Missing crawler issue translation: ${loc.code}.crawlIssues.${key}`,
        ).toBeDefined();
        expect(
          (loc.data.crawlIssues as any)?.[key],
          `English crawler issue fallback: ${loc.code}.crawlIssues.${key}`,
        ).not.toBe((en.crawlIssues as any)[key]);
      }
    }
  });

  it('localizes every crawler-readiness message without changing its data placeholders', () => {
    const readinessLeaves = (value: unknown, prefix = ''): string[] => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return prefix ? [prefix] : [];
      return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        return readinessLeaves(child, path);
      });
    };
    const keys = readinessLeaves(en.crawlerReadiness);

    for (const loc of locales.filter(({ code }) => code !== 'en')) {
      for (const key of keys) {
        let englishValue: unknown = en.crawlerReadiness;
        let localizedValue: unknown = (loc.data as any).crawlerReadiness;
        for (const segment of key.split('.')) {
          englishValue = (englishValue as Record<string, unknown>)[segment];
          localizedValue = (localizedValue as Record<string, unknown>)[segment];
        }
        if (key !== 'status.pass') {
          expect(localizedValue, `English crawler-readiness fallback: ${loc.code}.${key}`).not.toBe(englishValue);
        }
      }
    }
  });

  it('localizes desktop-only runtime feedback in every non-English locale', () => {
    const keys = flattenKeys(en.runtimeErrors.tauri);
    for (const loc of locales.filter(({ code }) => code !== 'en')) {
      for (const key of keys) {
        let englishValue: unknown = en.runtimeErrors.tauri;
        let localizedValue: unknown = (loc.data.runtimeErrors as any).tauri;
        for (const segment of key.split('.')) {
          englishValue = (englishValue as Record<string, unknown>)[segment];
          localizedValue = (localizedValue as Record<string, unknown>)[segment];
        }
        expect(localizedValue, `English desktop runtime fallback: ${loc.code}.${key}`).not.toBe(englishValue);
      }
    }
  });

  it('localizes the rendered element preview workflow in every non-English locale', () => {
    const keys = ['showOnPageTitle', 'previewWindowTitle', 'previewNotFound', 'previewError'];
    for (const loc of locales.filter(({ code }) => code !== 'en')) {
      for (const key of keys) {
        expect(
          (loc.data.componentUi as any)?.[key],
          `Missing componentUi.${key} in ${loc.code}`,
        ).toBeDefined();
        expect(
          (loc.data.componentUi as any)[key],
          `English preview fallback: ${loc.code}.componentUi.${key}`,
        ).not.toBe((en.componentUi as any)[key]);
      }
    }
  });

  it('localizes storage-recovery and DataForSEO quota feedback in every locale', () => {
    const keys = [
      ['runtimeErrors.tools.hydratedCompacted', (locale: any) => locale.runtimeErrors.tools.hydratedCompacted],
      ['runtimeErrors.ai.quota', (locale: any) => locale.runtimeErrors.ai.quota],
      ['runtimeErrors.ai.quotaExceeded', (locale: any) => locale.runtimeErrors.ai.quotaExceeded],
      ['mcp.dataforseoToolNotice', (locale: any) => locale.mcp.dataforseoToolNotice],
      ['dataforseo.quotaHint', (locale: any) => locale.dataforseo.quotaHint],
    ] as const;
    for (const loc of locales.filter(({ code }) => code !== 'en')) {
      for (const [key, read] of keys) {
        expect(read(loc.data), `English quota fallback: ${loc.code}.${key}`).not.toBe(read(en));
      }
    }
  });

  it('localizes the aria-hidden focus finding in every non-English locale', () => {
    const keys = [
      'focusableAriaHidden',
      'findingMessages.focusableAriaHidden',
      'findingRecommendations.focusableAriaHidden',
      'findingEvidence.focusableAriaHidden',
    ];
    const read = (locale: any, path: string): unknown => path
      .split('.')
      .reduce((value, segment) => value?.[segment], locale.accessibility);
    for (const loc of locales.filter(({ code }) => code !== 'en')) {
      for (const key of keys) {
        expect(read(loc.data, key), `Missing accessibility.${key} in ${loc.code}`).toBeDefined();
        expect(read(loc.data, key), `English fallback accessibility.${key} in ${loc.code}`).not.toBe(read(en, key));
      }
    }
  });

  it('localizes update-check failures in every non-English locale', () => {
    for (const loc of locales.filter(({ code }) => code !== 'en')) {
      expect((loc.data.settings as any)?.updateError, `English update-error fallback: ${loc.code}`).not.toBe(
        en.settings.updateError,
      );
    }
  });

  it('keeps the Polish AI visibility evidence surface translated', () => {
    const searchKeys = [
      'sourceDescription', 'sourceAria', 'sourceSaveError', 'evidenceRun',
      'promptStarted', 'noResponse', 'providerMeta', 'citationsLabel',
      'citationSummaryAria', 'citationContextAria', 'statusNoSnapshot',
      'statusInvalidUrl', 'statusAbsent', 'statusPresent', 'indexabilityUnknown',
      'lexicalContext', 'sentenceContext', 'excerptContext', 'semanticContext',
      'titleContext', 'noSignalContext', 'observableSignal', 'belowThreshold',
      'termPositions', 'responseSentence', 'localExcerpt',
    ];
    for (const key of searchKeys) {
      expect((pl.aiVisibility.search as any)[key], `Polish AI search fallback: ${key}`).not.toBe(
        (en.aiVisibility.search as any)[key],
      );
    }

    const brandKeys = [
      'eyebrow', 'mentionDescription', 'lastResearch', 'promptSummary',
      'savedResponses', 'mention', 'savedResponse', 'urlsLabel', 'noUrl',
    ];
    for (const key of brandKeys) {
      expect((pl.aiVisibility.brand as any)[key], `Polish AI brand fallback: ${key}`).not.toBe(
        (en.aiVisibility.brand as any)[key],
      );
    }
  });

  it('keeps the English audit-check labels free of Polish fallback copy', () => {
    const polishCharacters = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/u;
    const labels = [
      ...Object.values(en.auditChecks.categories),
      ...Object.values(en.auditChecks.labels),
    ];
    expect(labels.filter((value) => polishCharacters.test(value))).toEqual([]);
  });

  it('localizes the AI visibility workflow controls in every non-English locale', () => {
    const searchKeys = [
      'badge', 'eyebrow', 'title', 'description', 'localOnly', 'promptLabel',
      'promptPlaceholder', 'runLoading', 'run', 'samplesLabel', 'historyLabel',
      'historyAria', 'historyNote', 'sourceTitle', 'sourceDescription',
      'sourceLabel', 'sourceAria', 'noSnapshot', 'sourceSaveError',
    ];
    const brandKeys = [
      'badge', 'eyebrow', 'title', 'description', 'connected',
      'requiredConnection', 'analyze', 'noClients', 'mentionRate',
    ];
    for (const loc of locales.filter(({ code }) => code !== 'en')) {
      for (const key of searchKeys) {
        expect(
          (loc.data.aiVisibility.search as any)[key],
          `English AI search fallback: ${loc.code}.${key}`,
        ).not.toBe((en.aiVisibility.search as any)[key]);
      }
      for (const key of brandKeys) {
        expect(
          (loc.data.aiVisibility.brand as any)[key],
          `English AI brand fallback: ${loc.code}.${key}`,
        ).not.toBe((en.aiVisibility.brand as any)[key]);
      }
    }
  });

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
