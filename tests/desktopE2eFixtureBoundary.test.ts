import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

describe('desktop E2E fixture boundary regressions', () => {
  const loadScripts = (fixtureUrl: string) => {
    const rFile = resolve(process.cwd(), 'src-tauri/examples/desktop_e2e_renderer.js');
    const cFile = resolve(process.cwd(), 'src-tauri/examples/desktop_e2e_crawl.js');
    const win: any = { __seomiE2eFixtureUrl: fixtureUrl };
    vm.runInNewContext(readFileSync(cFile, 'utf8'), { window: win, URL, Date, Uint8Array, atob, globalThis: { crypto } }, { filename: cFile });
    vm.runInNewContext(readFileSync(rFile, 'utf8'), { window: win, URL, Date, Uint8Array, atob }, { filename: rFile });
    return { renderer: win.__seomiRendererE2e, crawl: win.__seomiDesktopCrawlValidation };
  };

  const fixtureOrigin = 'http://127.0.0.1:49152/';
  const check = (name: string, ok: boolean) => { if (!ok) throw new Error(name); };

  const baseArtifact = (kind: string, finalUrl = fixtureOrigin) => ({
    artifactType: kind, requestedUrl: fixtureOrigin, finalUrl, runId: 'desktop-e2e-renderer',
    capturedAt: '2026-10-25T10:00:00Z', contentType: kind === 'screenshot' ? 'image/png' : 'application/pdf',
    fileName: `rendered-page-20261025T100000Z-${kind}.${kind === 'screenshot' ? 'png' : 'pdf'}`,
    bytes: kind === 'screenshot' ? 8 : 5, rendererPlatform: 'macos-wkwebview',
    dataBase64: kind === 'screenshot' ? 'iVBORw0KGgo=' : 'JVBERi0=',
  });

  const baseCrawlPage = (final_url = fixtureOrigin, title = 'Example Domain') => ({
    final_url, http_status: 200, response_time_ms: 10, content_type: 'text/html; charset=utf-8',
    title, word_count: 24, semantic_content_source: 'primary-root', semantic_content_provenance: 'http',
  });

  const expectSnapFail = async (renderer: any, id: string, finalUrl: string, expected = 'Error: renderer final URL remains expected host') => {
    const res = await renderer.run({
      projectId: id,
      invoke: async (name: string) => (name === 'render_crawl_page' ? { html: '<title>Example Domain</title><h1>Example Domain</h1>', httpStatus: 200, finalUrl } : {}),
    });
    expect(res.passed).toBe(false);
    expect(res.failure).toBe(expected);
  };

  const expectCrawlFail = async (crawl: any, id: string, modeToFail: 'http' | 'browser-rendered', badUrl: string, expected: string) => {
    await expect(crawl.run({
      projectId: id, check,
      invoke: async (_: string, args: any) => ({
        crawl_mode: args.config.crawlMode, cancelled: false, timed_out: false,
        pages: [baseCrawlPage(args.config.crawlMode === modeToFail ? badUrl : fixtureOrigin)],
      }),
    })).rejects.toThrow(expected);
  };

  it('rejects Cloudflare rate limited HTML with captured diagnostics', async () => {
    const { renderer, crawl } = loadScripts(fixtureOrigin);
    const cfHtml = '<!DOCTYPE html><html><head><title>Rate Limited | example.com | Cloudflare</title></head><body>1015</body></html>';
    const res = await renderer.run({
      projectId: 'cf-test',
      invoke: async (name: string) => (name === 'render_crawl_page' ? { html: cfHtml, httpStatus: 200, finalUrl: fixtureOrigin } : {}),
    });
    expect(res.passed).toBe(false);
    expect(res.failure).toBe('Error: renderer HTML captured');
    expect(res.snapshot.htmlSnippet).toContain('Rate Limited');

    await expect(crawl.run({
      projectId: 'cf-crawl', check,
      invoke: async () => ({ crawl_mode: 'http', cancelled: false, timed_out: false, pages: [baseCrawlPage(fixtureOrigin, 'Rate Limited | Cloudflare')] }),
    })).rejects.toThrow('HTTP live HTML title is present');
  });

  it('rejects wrong host in renderer snapshot and crawl final URL', async () => {
    const { renderer, crawl } = loadScripts(fixtureOrigin);
    await expectSnapFail(renderer, 'host-snap', 'http://attacker.local:49152/');
    await expectCrawlFail(crawl, 'host-crawl', 'http', 'http://attacker.local:49152/', 'HTTP observed final URL is expected host');
  });

  it('rejects malformed final URL in renderer snapshot and crawl', async () => {
    const { renderer, crawl } = loadScripts(fixtureOrigin);
    await expectSnapFail(renderer, 'malformed-snap', 'http://[invalid/');
    await expectCrawlFail(crawl, 'malformed-crawl', 'http', 'http://[invalid/', 'HTTP observed final URL is expected host');
  });

  it('rejects wrong port in renderer snapshot, both crawl modes, and each artifact', async () => {
    const { renderer, crawl } = loadScripts(fixtureOrigin);
    const wrongPortUrl = 'http://127.0.0.1:8888/';
    await expectSnapFail(renderer, 'port-snap', wrongPortUrl);
    await expectCrawlFail(crawl, 'port-http', 'http', wrongPortUrl, 'HTTP observed final URL is expected host');
    await expectCrawlFail(crawl, 'port-rendered', 'browser-rendered', wrongPortUrl, 'browser-rendered observed final URL is expected host');

    const testArtifactFail = async (badKind: 'screenshot' | 'pdf', expectedError: string) => {
      const res = await renderer.run({
        projectId: `port-${badKind}`,
        invoke: async (name: string, args: any) => {
          if (name === 'render_crawl_page') return { html: '<title>Example Domain</title><h1>Example Domain</h1>', httpStatus: 200, finalUrl: fixtureOrigin };
          if (name === 'capture_rendered_artifact') return baseArtifact(args.kind, args.kind === badKind ? wrongPortUrl : fixtureOrigin);
          return {};
        },
      });
      expect(res.passed).toBe(false);
      expect(res.failure).toBe(expectedError);
    };
    await testArtifactFail('screenshot', 'Error: screenshot artifact final URL is exact');
    await testArtifactFail('pdf', 'Error: pdf artifact final URL is exact');
  });

  it('rejects wrong protocol in renderer snapshot and both crawl modes', async () => {
    const { renderer, crawl } = loadScripts(fixtureOrigin);
    const wrongProtoUrl = 'https://127.0.0.1:49152/';
    await expectSnapFail(renderer, 'proto-snap', wrongProtoUrl);
    await expectCrawlFail(crawl, 'proto-http', 'http', wrongProtoUrl, 'HTTP observed final URL is expected host');
    await expectCrawlFail(crawl, 'proto-rendered', 'browser-rendered', wrongProtoUrl, 'browser-rendered observed final URL is expected host');
  });

  it('passes all 48 assertions on exact origin with subpath', async () => {
    const { renderer } = loadScripts(fixtureOrigin);
    const exactSubpathUrl = `${fixtureOrigin}subpath?view=full`;
    const mockInvoke = async (name: string, args: any) => {
      if (name === 'render_crawl_page') {
        return { html: '<title>Example Domain</title><h1>Example Domain</h1><p>ok</p>', httpStatus: 200, finalUrl: exactSubpathUrl, contentType: 'text/html' };
      }
      if (name === 'capture_rendered_artifact') return baseArtifact(args.kind, fixtureOrigin);
      if (name === 'open_rendered_element_preview') return;
      if (name === 'crawl_site') {
        return {
          crawl_mode: args.config.crawlMode, cancelled: false, timed_out: false,
          pages: [baseCrawlPage(exactSubpathUrl)],
        };
      }
      throw new Error(`Unexpected invoke ${name}`);
    };

    const res = await renderer.run({ projectId: 'exact-origin-test', invoke: mockInvoke });
    expect(res.passed).toBe(true);
    expect(res.previewEvidence).toBe('ipc-success');
    expect(res.checks).toHaveLength(48);
  });
});
