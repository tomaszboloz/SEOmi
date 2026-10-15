import { describe, expect, it } from 'vitest';
import en from '@/i18n/locales/en.json';
import { SITE_FOCUS_CODES } from '@/services/siteFocus';

const focus = en.focus as unknown as Record<string, Record<string, unknown>>;
const nested = new Set(['recommendation', 'playbookOption']);

describe('focus i18n coverage', () => {
  for (const [group, codes] of Object.entries(SITE_FOCUS_CODES)) {
    it(`has English text for every ${group} code`, () => {
      for (const code of codes) {
        const entry = focus[group]?.[code];
        if (nested.has(group)) {
          const item = entry as { title?: string; detail?: string };
          expect(item?.title, `${group}.${code}.title`).toBeTruthy();
          expect(item?.detail, `${group}.${code}.detail`).toBeTruthy();
        } else {
          expect(typeof entry === 'string' && entry.length > 0, `${group}.${code}`).toBe(true);
        }
      }
    });
  }

  it('has every help.focus entry complete', () => {
    const ids = ['siteFocusScore', 'topicRelevance', 'coreTopicConfidence', 'onTopicRatio', 'semanticSimilarity', 'keywordOverlap', 'semanticDrift', 'keywordAlignment', 'deltaScore', 'lowConfidence'];
    for (const id of ids) {
      const entry = (en.help.focus as Record<string, Record<string, string>>)[id];
      for (const field of ['title', 'what', 'why', 'action', 'example']) expect(entry?.[field]?.trim(), `${id}.${field}`).toBeTruthy();
    }
  });

  it('labels the tab', () => {
    expect(en.crawl.tabs.focus).toBeTruthy();
  });
});
