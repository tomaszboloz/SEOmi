import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import i18n from '../src/i18n';
import { locales } from './fixtures/i18nContracts';

const TASK_KINDS = ['add-link', 'redirect-301', 'remove-410', 'add-entities', 'remove-noindex'] as const;
const TASK_STATUSES = ['planned', 'implemented', 'verified', 'failed'] as const;
const TASK_PRIORITIES = ['high', 'medium', 'low'] as const;
const TASK_FILTERS = ['all', 'mine', 'overdue'] as const;
const TASK_UI_KEYS = [
  'aria', 'title', 'add', 'added', 'empty', 'verify',
  'markImplemented', 'regression', 'owner', 'priority', 'dueDate', 'overdue', 'me',
] as const;

const VERDICT_CASES = [
  { key: 'link-found', params: { zone: 'main-article' }, expected: ['main-article'] },
  { key: 'link-missing', params: {}, expected: [] },
  { key: 'redirect-ok', params: {}, expected: [] },
  { key: 'redirect-wrong-target', params: {}, expected: [] },
  { key: 'still-200', params: { status: 200 }, expected: ['200'] },
  { key: 'gone-ok', params: {}, expected: [] },
  { key: 'wrong-status', params: { status: 500 }, expected: ['500'] },
  { key: 'entities-ok', params: { found: 6, total: 10 }, expected: ['6', '10'] },
  { key: 'entities-missing', params: { found: 3, total: 10 }, expected: ['3', '10'] },
  { key: 'index-ok', params: {}, expected: [] },
  { key: 'still-noindex', params: {}, expected: [] },
] as const;

describe('geminiEasy02 - task labels i18n regression in all 12 locales', () => {
  beforeAll(() => {
    for (const { code, data } of locales) {
      if (code !== 'en') i18n.addResourceBundle(code, 'translation', data, true, true);
    }
  });

  afterAll(async () => {
    await i18n.changeLanguage('en');
  });

  it.each(locales)('resolves all task kinds without raw key fallback in $code', ({ code }) => {
    for (const kind of TASK_KINDS) {
      const text = i18n.t(`executionCard.tasks.kind.${kind}`, { lng: code });
      expect(typeof text, `Missing string for task kind ${kind} in ${code}`).toBe('string');
      expect(text.trim().length, `Empty task kind ${kind} in ${code}`).toBeGreaterThan(0);
      expect(text, `Raw key leaked for kind ${kind} in ${code}`).not.toContain('executionCard.tasks');
    }
  });

  it.each(locales)('resolves all task lifecycle statuses and priorities in $code', ({ code }) => {
    for (const status of TASK_STATUSES) {
      const text = i18n.t(`executionCard.tasks.status.${status}`, { lng: code });
      expect(text.trim().length, `Empty status ${status} in ${code}`).toBeGreaterThan(0);
      expect(text).not.toContain('executionCard.tasks');
    }
    for (const priority of TASK_PRIORITIES) {
      const text = i18n.t(`executionCard.tasks.priorityLevel.${priority}`, { lng: code });
      expect(text.trim().length, `Empty priority ${priority} in ${code}`).toBeGreaterThan(0);
      expect(text).not.toContain('executionCard.tasks');
    }
    for (const filter of TASK_FILTERS) {
      const text = i18n.t(`executionCard.tasks.filter.${filter}`, { lng: code });
      expect(text.trim().length, `Empty filter ${filter} in ${code}`).toBeGreaterThan(0);
      expect(text).not.toContain('executionCard.tasks');
    }
  });

  it.each(locales)('resolves optimization tasks management UI labels in $code', ({ code }) => {
    for (const key of TASK_UI_KEYS) {
      const text = i18n.t(`executionCard.tasks.${key}`, { lng: code });
      expect(text.trim().length, `Empty UI key ${key} in ${code}`).toBeGreaterThan(0);
      expect(text).not.toContain('executionCard.tasks');
    }
  });

  it.each(locales)('interpolates all task verification verdicts with valid plain inputs in $code', ({ code }) => {
    for (const { key, params, expected } of VERDICT_CASES) {
      const text = i18n.t(`executionCard.tasks.verdict.${key}`, { lng: code, ...params });
      expect(text.trim().length, `Empty verdict ${key} in ${code}`).toBeGreaterThan(0);
      expect(text, `Unresolved key in verdict ${key} in ${code}`).not.toContain('executionCard.tasks');
      expect(text, `Unreplaced placeholder in verdict ${key} in ${code}`).not.toMatch(/{{\s*[^}]+\s*}}/);
      for (const token of expected) {
        expect(text, `Verdict ${key} in ${code} missing token ${token}`).toContain(token);
      }
    }
  });
});
