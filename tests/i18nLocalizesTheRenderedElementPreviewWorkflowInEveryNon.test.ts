import { describe, it, expect } from 'vitest';

import en from '../src/i18n/locales/en.json';
import pl from '../src/i18n/locales/pl.json';

import { locales } from "./fixtures/i18nContracts";

describe('i18n multi-language support', () => {

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
});
