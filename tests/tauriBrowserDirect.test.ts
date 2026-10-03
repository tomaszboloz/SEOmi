import { afterEach, expect, it, vi } from 'vitest';
import { handleBrowserFallback } from '@/services/tauri/browserFallback';
import { validateBrowserCrawlFilters } from '@/services/tauri/filters';
import { saveTextFile } from '@/services/tauri';
import { downloadBlob } from '@/services/download';

vi.mock('@/services/download', () => ({ downloadBlob: vi.fn() }));
afterEach(() => { localStorage.removeItem('seomi_language'); vi.restoreAllMocks(); });
it.each(['en', 'pl'])('loads browser configuration with language %s', async (language) => {
  if (language === 'pl') localStorage.setItem('seomi_language', language);
  await expect(handleBrowserFallback('get_config')).resolves.toEqual({
    theme: 'dark', language, default_user_agent: 'chrome_mac', request_timeout_secs: 15,
    max_redirects: 10, verify_ssl: true, ai_provider: 'openai', ai_model: 'gpt-4o',
    auto_check_updates: true, auto_install_updates: false,
  });
});
it('keeps secrets and config writes explicit no-ops', async () => {
  await expect(handleBrowserFallback('get_secret')).resolves.toBeNull();
  await expect(handleBrowserFallback('set_secret', { value: 'secret' })).resolves.toBeUndefined();
  await expect(handleBrowserFallback('save_config')).resolves.toBeUndefined();
  expect(localStorage.getItem('secret')).toBeNull();
});
it('reports all CLI providers as unavailable', async () => {
  await expect(handleBrowserFallback('detect_ai_clis')).resolves.toEqual([
    expect.objectContaining({ provider: 'openai', command: 'codex', available: false }),
    expect.objectContaining({ provider: 'claude', command: 'claude', available: false }),
    expect.objectContaining({ provider: 'gemini', command: 'gemini', available: false }),
  ]);
});
it.each([
  'inspect_url', 'check_for_updates', 'install_update', 'capture_rendered_artifact',
  'open_rendered_element_preview', 'start_render_worker', 'stop_render_worker', 'render_worker_status',
  'register_audit_wakeup', 'unregister_audit_wakeup', 'scheduled_launch_context',
  'register_audit_queue_wakeup', 'unregister_audit_queue_wakeup', 'save_scheduled_task',
  'delete_scheduled_task', 'load_scheduled_execution', 'list_scheduled_executions',
  'acknowledge_scheduled_execution', 'crawl_site',
])('rejects unavailable desktop command %s', async (command) => {
  await expect(handleBrowserFallback(command)).rejects.toThrow(/desktop|installed/);
});
it('includes the unknown command in the localized error', async () => {
  await expect(handleBrowserFallback('missing_command')).rejects.toThrow(/missing_command/);
});
it.each(['json', 'toml'] as const)('downloads browser %s exports with the correct MIME type', async (extension) => {
  await expect(saveTextFile({ defaultPath: `file.${extension}`, contents: 'content', extension, filterName: 'Export' })).resolves.toBe('downloaded');
  const [name, blob] = vi.mocked(downloadBlob).mock.calls.at(-1)!;
  expect(name).toBe(`file.${extension}`);
  expect(blob.size).toBe(7);
  expect(blob.type).toBe(`${extension === 'json' ? 'application/json' : 'text/plain'};charset=utf-8`);
});
it('accepts missing filter arguments', async () => {
  await expect(validateBrowserCrawlFilters()).resolves.toEqual({ valid: true, errors: [], previews: [] });
  await expect(handleBrowserFallback('validate_crawl_filters')).resolves.toEqual({ valid: true, errors: [], previews: [] });
});
it('ignores non-string input and applies include then exclude precedence', async () => {
  const result = await validateBrowserCrawlFilters({ includePatterns: ['docs', 1], excludePatterns: ['private', null],
    previewUrls: ['https://a/docs', 'https://a/docs/private', 'https://a/other', ' ', 2] });
  expect(result.valid).toBe(true);
  expect(result.previews).toEqual([
    { url: 'https://a/docs', included: true, reason: 'Accepted by the configured filters' },
    { url: 'https://a/docs/private', included: false, reason: 'Matches an exclude pattern' },
    { url: 'https://a/other', included: false, reason: 'Does not match any include pattern' },
  ]);
});
it('caps previews at 500 and accepts URLs when include patterns are empty', async () => {
  const result = await validateBrowserCrawlFilters({ includePatterns: null, excludePatterns: false,
    previewUrls: Array.from({ length: 501 }, (_, i) => `https://a/${i}`) });
  expect(result.previews).toHaveLength(500);
  expect(result.previews.every(({ included }) => included)).toBe(true);
});
it.each(['(', '😀'.repeat(2049)])('rejects invalid or oversized regex without previews', async (pattern) => {
  const result = await validateBrowserCrawlFilters({ excludePatterns: [pattern], previewUrls: ['https://a'] });
  expect(result.valid).toBe(false);
  expect(result.previews).toEqual([]);
  expect(result.errors).toEqual([expect.objectContaining({ filter: 'exclude', pattern, message: expect.any(String) })]);
});
it('counts regex limit in Unicode codepoints', async () => {
  const result = await validateBrowserCrawlFilters({ includePatterns: ['😀'.repeat(2048)] });
  expect(result).toEqual({ valid: true, errors: [], previews: [] });
});
it('handles non-Error regex constructor failures with localized diagnostics', async () => {
  vi.stubGlobal('RegExp', vi.fn(function () { throw 'constructor unavailable'; }));
  try {
    const result = await validateBrowserCrawlFilters({ includePatterns: ['docs'] });
    expect(result).toEqual({ valid: false, previews: [], errors: [
      { filter: 'include', pattern: 'docs', message: 'Invalid regular expression.' },
    ] });
  } finally { vi.unstubAllGlobals(); }
});
