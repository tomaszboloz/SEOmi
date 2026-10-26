import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

describe('desktop E2E scripts with dynamic fixture origin', () => {
  const loadScripts = (fixtureUrl: string) => {
    const rendererFile = resolve(process.cwd(), 'src-tauri/examples/desktop_e2e_renderer.js');
    const crawlFile = resolve(process.cwd(), 'src-tauri/examples/desktop_e2e_crawl.js');
    const rendererText = readFileSync(rendererFile, 'utf8');
    const crawlText = readFileSync(crawlFile, 'utf8');

    const windowObj: any = {
      __seomiE2eFixtureUrl: fixtureUrl,
    };
    vm.runInNewContext(crawlText, { window: windowObj, URL, Date, Uint8Array, atob, globalThis: { crypto } }, { filename: crawlFile });
    vm.runInNewContext(rendererText, { window: windowObj, URL, Date, Uint8Array, atob }, { filename: rendererFile });
    return {
      renderer: windowObj.__seomiRendererE2e,
      crawl: windowObj.__seomiDesktopCrawlValidation,
    };
  };

  it('runs renderer and crawl against dynamic local fixture origin', async () => {
    const fixtureOrigin = 'http://127.0.0.1:49152/';
    const { renderer, crawl } = loadScripts(fixtureOrigin);

    const checks: string[] = [];
    const check = (name: string, value: boolean) => {
      if (!value) throw new Error(name);
      checks.push(name);
    };

    const mockInvoke = async (name: string, args: any) => {
      if (name === 'crawl_site') {
        return {
          crawl_mode: args.config.crawlMode,
          cancelled: false,
          timed_out: false,
          pages: [{
            final_url: fixtureOrigin,
            http_status: 200,
            response_time_ms: 12,
            content_type: 'text/html; charset=utf-8',
            title: 'Example Domain',
            word_count: 24,
            semantic_content_source: 'primary-root',
            semantic_content_provenance: args.config.crawlMode === 'http' ? 'http' : 'rendered',
          }],
        };
      }
      if (name === 'render_crawl_page') {
        return {
          html: '<title>Example Domain</title><h1>Example Domain</h1><p>Words</p>',
          httpStatus: 200,
          finalUrl: fixtureOrigin,
          contentType: 'text/html; charset=utf-8',
        };
      }
      if (name === 'capture_rendered_artifact') {
        const png = args?.kind === 'screenshot';
        return {
          artifactType: args?.kind,
          requestedUrl: fixtureOrigin,
          finalUrl: fixtureOrigin,
          runId: 'desktop-e2e-renderer',
          capturedAt: '2026-10-25T10:00:00Z',
          contentType: png ? 'image/png' : 'application/pdf',
          fileName: `rendered-page-20261025T100000Z-${args?.kind}.${png ? 'png' : 'pdf'}`,
          bytes: png ? 8 : 5,
          rendererPlatform: 'macos-wkwebview',
          dataBase64: png ? 'iVBORw0KGgo=' : 'JVBERi0=',
        };
      }
      if (name === 'open_rendered_element_preview') return;
      throw new Error(`Unexpected invoke ${name}`);
    };

    const crawlResult = await crawl.run({
      projectId: 'fixture-test',
      check,
      invoke: mockInvoke,
    });

    expect(crawlResult.http.pages).toHaveLength(1);
    expect(crawlResult.rendered.pages).toHaveLength(1);
    expect(checks).toContain('HTTP observed final URL is expected host');
    expect(checks).toContain('browser-rendered observed final URL is expected host');

    const rendererResult = await renderer.run({
      projectId: 'fixture-test',
      invoke: mockInvoke,
    });

    expect(rendererResult.passed).toBe(true);
    expect(rendererResult.checks).toContain('renderer HTML captured');
    expect(rendererResult.checks).toContain('renderer final URL remains expected host');
  });
});
