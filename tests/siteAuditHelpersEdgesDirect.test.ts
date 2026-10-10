import { afterEach, describe, expect, it, vi } from 'vitest';
import { focusCrawlStartForm } from '@/components/Domain/siteAudit/siteAuditHelpers';

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('site audit focus helper edge contracts', () => {
  it('does nothing when called without a browser window', () => {
    vi.stubGlobal('window', undefined);
    expect(() => focusCrawlStartForm()).not.toThrow();
  });

  it('focuses the form immediately and honors reduced motion', () => {
    const form = document.createElement('div');
    const startUrl = document.createElement('input');
    form.id = 'site-audit-crawl-form';
    startUrl.id = 'site-audit-start-url';
    const scrollIntoView = vi.fn();
    form.scrollIntoView = scrollIntoView;
    document.body.append(form, startUrl);
    vi.stubGlobal('window', {
      matchMedia: vi.fn(() => ({ matches: true })),
      requestAnimationFrame: undefined,
    });

    focusCrawlStartForm();

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
    expect(document.activeElement).toBe(startUrl);
  });

  it('schedules focus through requestAnimationFrame for normal motion', () => {
    const form = document.createElement('div');
    const startUrl = document.createElement('input');
    form.id = 'site-audit-crawl-form';
    startUrl.id = 'site-audit-start-url';
    const scrollIntoView = vi.fn();
    form.scrollIntoView = scrollIntoView;
    document.body.append(form, startUrl);
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('window', {
      matchMedia: vi.fn(() => ({ matches: false })),
      requestAnimationFrame,
    });

    focusCrawlStartForm();

    expect(requestAnimationFrame).toHaveBeenCalledOnce();
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });
});
