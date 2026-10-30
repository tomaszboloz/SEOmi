import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { SpaShellRenderPanel } from '@/components/Domain/crawlResults/SpaShellRenderPanel';
import { readSpaAutoRender, SPA_AUTO_RENDER_KEY } from '@/hooks/useSpaAutoRender';
import { MAX_SHELL_RENDERS } from '@/hooks/useSpaShellRender';
import type { RenderedPageSnapshot } from '@/services/tauri/rendered';
import { createCrawlPageFixture } from './fixtures/crawl';

const snapshot = (url: string): RenderedPageSnapshot => ({
  requestedUrl: url, finalUrl: url, contentType: 'text/html', charset: 'utf-8', html: '<p>Rendered words here</p>',
  htmlTruncated: false, failedResourceUrls: [], consoleErrors: [],
});
const shells = (count: number, prefix = 'a') => Array.from({ length: count }, (_, i) =>
  createCrawlPageFixture({ url: `https://s.test/${prefix}${i}`, word_count: 1, is_js_shell_suspected: true }));

beforeEach(async () => { localStorage.clear(); await i18n.changeLanguage('en'); });
afterEach(cleanup);

describe('opt-in automatic shell render (#131)', () => {
  it('is off by default and renders nothing until the user starts it', () => {
    const renderer = vi.fn(async (url: string) => snapshot(url));
    render(<SpaShellRenderPanel shells={shells(2)} render={renderer} />);
    expect(readSpaAutoRender()).toBe(false);
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
    expect(renderer).not.toHaveBeenCalled();
  });

  it('starts the capped batch automatically once enabled and remembers the choice', async () => {
    const renderer = vi.fn(async (url: string) => snapshot(url));
    const list = shells(MAX_SHELL_RENDERS + 3);
    const { rerender } = render(<SpaShellRenderPanel shells={list} render={renderer} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(localStorage.getItem(SPA_AUTO_RENDER_KEY)).toBe('true');
    await waitFor(() => expect(renderer).toHaveBeenCalledTimes(MAX_SHELL_RENDERS));
    await waitFor(() => expect(screen.getAllByText(/words 1 → 3/)).toHaveLength(MAX_SHELL_RENDERS));
    rerender(<SpaShellRenderPanel shells={list} render={renderer} />);
    expect(renderer).toHaveBeenCalledTimes(MAX_SHELL_RENDERS);
    const next = shells(1, 'b');
    rerender(<SpaShellRenderPanel shells={next} render={renderer} />);
    await waitFor(() => expect(renderer).toHaveBeenLastCalledWith('https://s.test/b0'));
  });

  it('does not restart a batch the user cancelled', async () => {
    localStorage.setItem(SPA_AUTO_RENDER_KEY, 'true');
    const renderer = vi.fn(() => new Promise<RenderedPageSnapshot>(() => undefined));
    render(<SpaShellRenderPanel shells={shells(2)} render={renderer} />);
    await waitFor(() => expect(renderer).toHaveBeenCalledTimes(1));
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Stop rendering' })); });
    expect(screen.getAllByText('cancelled')).toHaveLength(2);
    expect(renderer).toHaveBeenCalledTimes(1);
  });

  it('can be switched off again', () => {
    localStorage.setItem(SPA_AUTO_RENDER_KEY, 'true');
    render(<SpaShellRenderPanel shells={[]} render={vi.fn()} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(readSpaAutoRender()).toBe(false);
  });
});
