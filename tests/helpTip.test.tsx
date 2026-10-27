import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import i18n, { LANGUAGES } from '@/i18n';
import { HelpTip } from '@/components/Help/HelpTip';
import en from '@/i18n/locales/en.json';

const ids = Object.entries(en.help).flatMap(([area, entries]) => Object.keys(entries).map((key) => `${area}.${key}`));

describe('HelpTip', () => {
  it('opens a described tooltip with what / why / action on click', () => {
    render(<HelpTip id="overview.healthScore" />);
    const button = screen.getByRole('button', { name: en.help.overview.healthScore.title });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(button);
    const tooltip = screen.getByRole('tooltip');
    expect(button.getAttribute('aria-describedby')).toBe(tooltip.id);
    expect(tooltip.textContent).toContain(en.help.overview.healthScore.what);
  });

  it('renders nothing for an unknown id', () => {
    const { container } = render(<HelpTip id={'overview.nope' as never} />);
    expect(container.querySelector('button')).toBeNull();
  });

  it('has complete English entries for every id', () => {
    for (const id of ids) {
      const [area, key] = id.split('.') as [keyof typeof en.help, string];
      const entry = (en.help[area] as Record<string, Record<string, string>>)[key];
      for (const field of ['title', 'what', 'why', 'action']) expect(entry[field]?.trim(), `${id}.${field}`).toBeTruthy();
    }
  });

  it('keeps every locale on the same help keys', async () => {
    for (const { code } of LANGUAGES) {
      await i18n.loadLanguages?.(code);
      const bundle = (await import(`../src/i18n/locales/${code}.json`)).default.help as typeof en.help;
      for (const id of ids) {
        const [area, key] = id.split('.') as [keyof typeof en.help, string];
        expect((bundle[area] as Record<string, unknown>)?.[key], `${code}:${id}`).toBeTruthy();
      }
    }
  });
});
