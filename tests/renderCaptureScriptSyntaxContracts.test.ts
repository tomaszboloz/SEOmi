import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

const base = 'src-tauri/src/commands/rendered_crawler/';
const runtime = readFileSync(`${base}capture_runtime.js`, 'utf8');
const collector = readFileSync(`${base}capture_collector.js`, 'utf8');
const transport = readFileSync('src-tauri/src/commands/render_capture_transport.js', 'utf8');
const nonce = 'nonce-"\\-é';
const replace = (source: string, replacements: Record<string, string>) =>
  Object.entries(replacements).reduce((text, [key, value]) => text.replaceAll(key, value), source);

function preparedRuntime(sequence = 4) {
  return replace(runtime, {
    __NONCE__: JSON.stringify(nonce), __SEQUENCE__: String(sequence),
    __WAIT_SELECTOR__: 'null', __WAIT_DELAY_MS__: '0', __SCROLL_CYCLES__: '0',
    __NETWORK_IDLE_MAX_WAIT_MS__: '0', __NETWORK_IDLE_QUIET_MS__: '0',
    __NETWORK_IDLE_POLL_MS__: '1', __DOM_IDLE_MAX_WAIT_MS__: '0', __DOM_IDLE_QUIET_MS__: '0',
  });
}

function preparedCollector(transfer = 'async function sendCaptureChunks(encoded, nonce, sequence) { window.deliveries.push({ encoded, nonce, sequence }); }') {
  return replace(collector, {
    __MAX_CAPTURE_HTML_CHARS__: '200', __TRANSPORT__: transfer,
    __MAX_CAPTURE_CHUNK_BYTES__: '32', __MAX_CAPTURE_CHUNKS__: '100',
  });
}

function fixture() {
  const listeners = new Map<string, (event: unknown) => void>();
  const deliveries: { encoded: string; nonce: string; sequence: number }[] = [];
  const window = {
    deliveries, scrollTo: vi.fn(),
    addEventListener: vi.fn((name: string, callback: (event: unknown) => void) => listeners.set(name, callback)),
    removeEventListener: vi.fn(),
  };
  const location = { href: 'https://example.test/path' };
  const context = createContext({
    window, location, TextEncoder,
    console: { error: vi.fn() },
    document: { documentElement: { outerHTML: '<html><body>Zażółć 世界</body></html>' }, contentType: 'text/html', characterSet: 'UTF-8' },
    performance: { getEntriesByType: () => [{ responseStatus: 200, duration: 12.7 }] },
    setTimeout: (callback: () => void) => { callback(); return 1; },
    btoa: (value: string) => Buffer.from(value, 'binary').toString('base64'),
  });
  return { context, window, location, listeners, deliveries };
}

it.each(['capture_runtime.js', 'capture_collector.js'])('has standalone valid JavaScript syntax in %s', filename => {
  expect(() => new Script(readFileSync(`${base}${filename}`, 'utf8'), { filename })).not.toThrow();
});

it('parses the complete script including the real acknowledged transport', () => {
  const source = `(() => { ${preparedRuntime()} ${preparedCollector(transport)}
    prepareCapture()?.then(collectCapture).catch(() => { location.href = 'seomi-capture://' + ${JSON.stringify(nonce)} + '/4/error'; });
  })();`;
  expect(() => new Script(source)).not.toThrow();
});

it('passes capture state into the collector and transfers a Unicode-safe page payload once', async () => {
  const f = fixture();
  const invoke = new Script(`${preparedRuntime()} ${preparedCollector()}
    (async () => {
      const pending = prepareCapture();
      console.error('captured failure');
      await collectCapture(await pending);
      return prepareCapture();
    })();`);
  expect(await invoke.runInContext(f.context)).toBeUndefined();
  expect(f.deliveries).toHaveLength(1);
  expect(f.deliveries[0]).toMatchObject({ nonce, sequence: 4 });
  const page = JSON.parse(Buffer.from(f.deliveries[0].encoded, 'base64url').toString('utf8'));
  expect(page).toMatchObject({ page_url: 'https://example.test/path', http_status: 200,
    html: '<html><body>Zażółć 世界</body></html>', html_truncated: false,
    navigation_time_ms: 13, console_errors: ['captured failure'], failed_resource_urls: [],
    lcp_ms: null, inp_ms: null, cls: null });
  expect(f.window.removeEventListener).toHaveBeenCalledWith('error', expect.any(Function), true);
});

it('retains the failure callback for rejected capture preparation', async () => {
  const f = fixture();
  f.window.scrollTo.mockImplementation(() => { throw new Error('fixture scroll failure'); });
  const source = `(() => { ${preparedRuntime()} ${preparedCollector()}
    return prepareCapture()?.then(collectCapture).catch(() => { location.href = 'seomi-capture://' + ${JSON.stringify(nonce)} + '/4/error'; });
  })();`;
  await new Script(source).runInContext(f.context);
  expect(f.location.href).toBe(`seomi-capture://${nonce}/4/error`);
  expect(f.deliveries).toHaveLength(0);
});
