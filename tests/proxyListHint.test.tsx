import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { CrawlRequestProfileForm } from '@/components/Domain/siteAudit/CrawlRequestProfileForm';

import { makeSession, text } from './fixtures/crawlControlPanelsContracts';

const LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'zh'];

afterEach(cleanup);

it('shows the multi-proxy hint under the proxy field and accepts a proxy list', () => {
  const session = makeSession({ setRequestProfileProxyUrl: vi.fn() });
  render(<CrawlRequestProfileForm session={session} />);
  expect(screen.getByText(text('siteAudit.proxyListHint'))).toBeTruthy();
  const input = screen.getByLabelText((label) => label.startsWith(text('siteAudit.httpProxy')));
  expect(input.getAttribute('maxlength')).toBe('16384');
  const list = 'http://a.test:8080, https://b.test:443';
  fireEvent.change(input, { target: { value: list } });
  expect(session.setRequestProfileProxyUrl).toHaveBeenCalledWith(list);
});

it('translates the proxy list hint in every locale without reusing the English text', async () => {
  const english = (await import('@/i18n/locales/en.json')).default.siteAudit.proxyListHint;
  expect(english).toMatch(/64/);
  for (const locale of LOCALES) {
    const hint = (await import(`@/i18n/locales/${locale}.json`)).default.siteAudit.proxyListHint as string;
    expect(typeof hint, locale).toBe('string');
    expect(hint, locale).toMatch(/64/);
    if (locale !== 'en') expect(hint, locale).not.toBe(english);
  }
});
