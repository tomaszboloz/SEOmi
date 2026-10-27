import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n, { setLanguageDirection } from '../src/i18n';
import { HelpTip } from '../src/components/Help/HelpTip';
import type { HelpId } from '../src/components/Help/helpTypes';
import en from '../src/i18n/locales/en.json';
import { locales } from './fixtures/i18nContracts';

const allHelpIds = Object.entries(en.help).flatMap(([area, entries]) =>
  Object.keys(entries).map((key) => `${area}.${key}` as HelpId),
);

const HELP_UI_KEYS = ['what', 'why', 'action', 'example', 'learnMore'] as const;

describe('geminiEasy02 - contextual help and HelpTip registry in all 12 locales', () => {
  beforeAll(() => {
    for (const { code, data } of locales) {
      if (code !== 'en') i18n.addResourceBundle(code, 'translation', data, true, true);
    }
  });

  afterEach(() => {
    cleanup();
  });

  afterAll(async () => {
    await setLanguageDirection('en');
  });

  it.each(locales)('has complete title/what/why/action for every HelpId in $code', ({ code, data }) => {
    const helpBundle = (data as typeof en).help;
    for (const id of allHelpIds) {
      const [area, key] = id.split('.') as [keyof typeof en.help, string];
      const entry = (helpBundle[area] as Record<string, Record<string, string>>)?.[key];
      expect(entry, `Missing help entry for ${id} in ${code}`).toBeDefined();
      for (const field of ['title', 'what', 'why', 'action']) {
        const value = entry[field];
        expect(typeof value, `Field ${field} of ${id} in ${code} must be a string`).toBe('string');
        expect(value.trim().length, `Field ${field} of ${id} in ${code} cannot be empty`).toBeGreaterThan(0);
      }
    }
  });

  it.each(locales)('resolves all helpUi structure headers in $code', ({ code }) => {
    for (const key of HELP_UI_KEYS) {
      const text = i18n.t(`helpUi.${key}`, { lng: code });
      expect(typeof text, `Missing helpUi.${key} in ${code}`).toBe('string');
      expect(text.trim().length, `Empty helpUi.${key} in ${code}`).toBeGreaterThan(0);
      expect(text).not.toContain('helpUi');
    }
  });

  it.each([
    { code: 'en', id: 'executionCard.tasks' as const, dir: 'ltr' },
    { code: 'pl', id: 'executionCard.tasks' as const, dir: 'ltr' },
    { code: 'de', id: 'executionCard.tasks' as const, dir: 'ltr' },
    { code: 'ar', id: 'executionCard.tasks' as const, dir: 'rtl' },
    { code: 'en', id: 'causalMarket.updateWindow' as const, dir: 'ltr' },
    { code: 'pl', id: 'causalMarket.updateWindow' as const, dir: 'ltr' },
    { code: 'ja', id: 'causalMarket.updateWindow' as const, dir: 'ltr' },
  ])('renders interactive HelpTip $id in $code ($dir)', async ({ code, id, dir }) => {
    await setLanguageDirection(code);

    const [area, key] = id.split('.') as [keyof typeof en.help, string];
    const locData = locales.find((l) => l.code === code)!.data as typeof en;
    const entry = locData.help[area][key as never] as Record<string, string>;

    render(<HelpTip id={id} />);

    const button = screen.getByRole('button', { name: entry.title });
    expect(button).toBeDefined();
    expect(button.getAttribute('data-help-id')).toBe(id);
    expect(button.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(button);

    expect(button.getAttribute('aria-expanded')).toBe('true');
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeDefined();
    expect(button.getAttribute('aria-describedby')).toBe(tooltip.id);
    expect(tooltip.getAttribute('dir')).toBe(dir);
    expect(tooltip.textContent).toContain(entry.what);
  });
});
