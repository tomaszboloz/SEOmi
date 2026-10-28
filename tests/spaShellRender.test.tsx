import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { SpaShellRenderPanel } from '@/components/Domain/crawlResults/SpaShellRenderPanel';
import { MAX_SHELL_RENDERS, useSpaShellRender } from '@/hooks/useSpaShellRender';
import { compareShellRender, renderedCounts } from '@/services/spaRender/compare';
import type { RenderedPageSnapshot } from '@/services/tauri/rendered';
import { createCrawlPageFixture } from './fixtures/crawl';

afterEach(cleanup);

const snapshot = (html: string, patch: Partial<RenderedPageSnapshot> = {}): RenderedPageSnapshot => ({
  requestedUrl: 'https://s.test/a', finalUrl: 'https://s.test/a', contentType: 'text/html', charset: 'utf-8', html,
  htmlTruncated: false, failedResourceUrls: [], consoleErrors: [], ...patch,
});
const APP = '<html><head><title> App </title><style>p{}</style></head><body><script>var x = "not words"</script>'
  + '<p>Rendered product copy here</p><a href="/b">B</a><a href="/b#top">B</a><a href="https://other.test/">X</a><a href="mailto:a@b">M</a><a href="http://[x">bad</a></body></html>';
const shell = (url: string) => createCrawlPageFixture({ url, title: 'Loading', word_count: 2, internal_link_count: 0, is_js_shell_suspected: true });

describe('compareShellRender', () => {
  it('counts visible words, title and unique same-host links of the rendered DOM', () => {
    expect(renderedCounts(snapshot(APP))).toEqual({ title: 'App', words: 9, internalLinks: 1 });
    expect(compareShellRender(shell('https://s.test/a'), snapshot(APP, { htmlTruncated: true, consoleErrors: ['e'] }))).toEqual({
      url: 'https://s.test/a', raw: { title: 'Loading', words: 2, internalLinks: 0 }, rendered: { title: 'App', words: 9, internalLinks: 1 },
      wordDelta: 7, htmlTruncated: true, consoleErrors: 1,
    });
    expect(renderedCounts(snapshot('<p>x</p>', { finalUrl: 'not a url' })).internalLinks).toBe(0);
  });
});

describe('useSpaShellRender', () => {
  it('renders a capped batch one page at a time and records failures', async () => {
    const shells = Array.from({ length: MAX_SHELL_RENDERS + 2 }, (_, i) => shell(`https://s.test/${i}`));
    const renderer = vi.fn(async (url: string) => (url.endsWith('/1') ? Promise.reject(new Error('timeout')) : snapshot(APP, { finalUrl: url })));
    const { result } = renderHook(() => useSpaShellRender(shells, renderer));
    act(() => result.current.start());
    await waitFor(() => expect(result.current.running).toBe(false));
    expect(renderer).toHaveBeenCalledTimes(MAX_SHELL_RENDERS);
    expect(result.current.rows.map((row) => row.status)).toEqual(['done', 'error', ...Array(MAX_SHELL_RENDERS - 2).fill('done')]);
    expect(result.current.rows[1]).toMatchObject({ error: 'timeout' });
  });

  it('cancels pending pages and resets when the crawl changes', async () => {
    let release: (value: RenderedPageSnapshot) => void = () => undefined;
    const renderer = vi.fn(() => new Promise<RenderedPageSnapshot>((resolve) => { release = resolve; }));
    const first = [shell('https://s.test/a'), shell('https://s.test/b')];
    const { result, rerender } = renderHook(({ shells }) => useSpaShellRender(shells, renderer), { initialProps: { shells: first } });
    act(() => result.current.start());
    await waitFor(() => expect(result.current.rows[0].status).toBe('rendering'));
    act(() => result.current.cancel());
    expect(result.current.rows.map((row) => row.status)).toEqual(['cancelled', 'cancelled']);
    await act(async () => { release(snapshot(APP)); });
    expect(result.current.rows[0].status).toBe('cancelled');
    expect(renderer).toHaveBeenCalledTimes(1);
    rerender({ shells: [shell('https://s.test/c')] });
    expect(result.current.rows).toEqual([]);
    expect(result.current.running).toBe(false);
  });
});

describe('SpaShellRenderPanel', () => {
  it('explains that rendering needs the desktop app in the browser build', () => {
    render(<SpaShellRenderPanel shells={[shell('https://s.test/a')]} />);
    expect(screen.getByText('Rendering shell pages is available in the installed desktop app.')).toBeTruthy();
  });

  it('starts, shows the raw and rendered comparison and errors', async () => {
    const renderer = vi.fn(async (url: string) => (url.endsWith('/b') ? Promise.reject('blocked') : snapshot(APP, { consoleErrors: ['e'], htmlTruncated: true })));
    render(<SpaShellRenderPanel shells={[shell('https://s.test/a'), shell('https://s.test/b')]} render={renderer} />);
    fireEvent.click(screen.getByRole('button', { name: 'Render 2 shell pages in the browser' }));
    expect(await screen.findByText(/words 2 → 9 \(\+7\) · internal links 0 → 1 · rendered title: App · rendered HTML truncated · console errors: 1/)).toBeTruthy();
    expect(await screen.findByText('render failed: blocked')).toBeTruthy();
  });

  it('shows queue states and stops on demand', async () => {
    const renderer = vi.fn(() => new Promise<RenderedPageSnapshot>(() => undefined));
    render(<SpaShellRenderPanel shells={[shell('https://s.test/a'), shell('https://s.test/b')]} render={renderer} />);
    fireEvent.click(screen.getByRole('button', { name: 'Render 2 shell pages in the browser' }));
    expect(await screen.findByText('rendering…')).toBeTruthy();
    expect(screen.getByText('waiting')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Stop rendering' }));
    expect(screen.getAllByText('cancelled')).toHaveLength(2);
  });
});
