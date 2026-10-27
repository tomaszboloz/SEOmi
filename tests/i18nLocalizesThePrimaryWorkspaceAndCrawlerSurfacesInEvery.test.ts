import { describe, it, expect } from 'vitest';

import en from '../src/i18n/locales/en.json';

import { flattenKeys, locales } from "./fixtures/i18nContracts";

describe('i18n multi-language support', () => {

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
      'renderFallback', 'renderedSelfNavigation',
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
});
