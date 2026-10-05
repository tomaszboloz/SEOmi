import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { MetadataDirectives } from '@/components/Results/metadata/MetadataDirectives';

const copy = vi.hoisted(() => vi.fn());
vi.mock('@/services/clipboard', () => ({ copyText: copy }));

const render_ = (meta: Record<string, unknown> = {}, indexability?: Record<string, unknown>) =>
  render(<MetadataDirectives audit={{ meta_tags: meta, indexability } as never} />);
const tx = (key: string, o?: object) => i18n.t(`legacyUi.metadata.${key}`, o);

beforeEach(async () => {
  await i18n.changeLanguage('en');
  copy.mockReset();
});

describe('MetadataDirectives defaults', () => {
  it('flags missing canonical and viewport and shows implicit robots and charset', () => {
    render_();
    expect(screen.getByText(tx('notSpecified')).className).toContain('amber');
    expect(screen.getByText(tx('missingViewport')).className).toContain('rose');
    expect(screen.getByText(tx('robotsDefault'))).toBeTruthy();
    expect(screen.getByText(tx('utf8'))).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    for (const key of ['keywords', 'themeColor', 'generator', 'author']) expect(screen.queryByText(tx(key))).toBeNull();
  });

  it('shows explicit values and the optional rows', () => {
    render_({ robots: 'noindex', viewport: 'width=device-width', charset: 'iso-8859-2', keywords: 'a, b', theme_color: '#112233', generator: 'WP 6', author: 'Ann' });
    for (const text of ['noindex', 'width=device-width', 'iso-8859-2', 'a, b', '#112233', 'WP 6', 'Ann']) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.getByText('#112233').previousElementSibling).toHaveProperty('style.backgroundColor', 'rgb(17, 34, 51)');
  });
});

describe('MetadataDirectives canonical verification', () => {
  const canonical = { canonical: 'https://a.test/' };

  it('colours the checked target status by HTTP class', () => {
    const ok = render_(canonical, { canonical_target_checked: true, canonical_target_status: 200 });
    expect(screen.getByText(i18n.t('exportUi.statuses.http', { status: 200 })).className).toContain('emerald');
    ok.unmount();
    const bad = render_(canonical, { canonical_target_checked: true, canonical_target_status: 404 });
    expect(screen.getByText(i18n.t('exportUi.statuses.http', { status: 404 })).className).toContain('rose');
    bad.unmount();
    render_(canonical, { canonical_target_checked: true });
    expect(screen.getByText(/^HTTP\s*$/).className).toContain('rose');
  });

  it('shows an unverified marker with the error as tooltip', () => {
    render_(canonical, { canonical_target_check_error: 'timeout' });
    expect(screen.getByText(tx('canonicalUnverified')).getAttribute('title')).toBe('timeout');
  });

  it('shows no status for an unchecked canonical', () => {
    const { container } = render_(canonical, { canonical_target_checked: false });
    expect(container.querySelector('.text-emerald-300, .text-rose-300')).toBeNull();
  });
});

describe('MetadataDirectives copy', () => {
  it('copies the canonical and shows then clears the confirmation', async () => {
    copy.mockResolvedValue(true);
    render_({ canonical: 'https://a.test/' });
    const button = screen.getByRole('button');
    expect(button.querySelector('.lucide-copy')).toBeTruthy();
    fireEvent.click(button);
    expect(copy).toHaveBeenCalledWith('https://a.test/');
    await waitFor(() => expect(button.querySelector('.lucide-check')).toBeTruthy());
    await waitFor(() => expect(button.querySelector('.lucide-copy')).toBeTruthy(), { timeout: 3000 });
  });

  it('shows no confirmation when the clipboard refuses', async () => {
    copy.mockResolvedValue(false);
    render_({ canonical: 'https://a.test/' });
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(copy).toHaveBeenCalled());
    expect(screen.getByRole('button').querySelector('.lucide-check')).toBeNull();
  });
});
