import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

describe('desktop_e2e_renderer script execution and diagnostics', () => {
  const loadScript = () => {
    const file = resolve(process.cwd(), 'src-tauri/examples/desktop_e2e_renderer.js');
    const text = readFileSync(file, 'utf8');
    const windowObj = {
      __seomiDesktopCrawlValidation: {
        run: async ({ check }: { check: (name: string, value: boolean) => void }) => {
          check('controlled actual crawl dependency', true);
          return { fixture: true };
        },
      },
    };
    vm.runInNewContext(text, { window: windowObj, URL, Date, Uint8Array, atob }, { filename: file });
    return (windowObj as unknown as { __seomiRendererE2e: any }).__seomiRendererE2e;
  };

  it.each([
    ['empty string', ''],
    ['whitespace', '   '],
    ['HTTP error page', '<html>Error404</html>'],
    ['WebKit error page', '<html><title>Cannot Open Page</title></html>'],
    ['about blank', '<html>about:blank</html>'],
    ['Cloudflare rate limit', '<title>Rate Limited | example.com | Cloudflare</title>'],
  ])('rejects invalid HTML (%s) and retains diagnostics', async (_, html) => {
    const api = loadScript();
    const result = await api.run({
      projectId: 'audit',
      invoke: async (name: string) => {
        if (name === 'render_crawl_page') {
          return {
            html,
            httpStatus: null,
            finalUrl: 'https://example.com/',
            contentType: 'text/html',
            consoleErrors: ['known-error'],
            failedResourceUrls: ['https://example.com/missing'],
          };
        }
        throw new Error(`Unexpected invoke ${name}`);
      },
    });

    expect(result.passed).toBe(false);
    expect(result.failure).toBe('Error: renderer HTML captured');
    expect(result.snapshot.htmlLength).toBe(html.length);
    expect(result.snapshot.htmlSnippet).toBe(html.slice(0, 256));
    expect(result.snapshot.observedFinalUrl).toBe('https://example.com/');
    expect(result.snapshot.observedContentType).toBe('text/html');
    expect(result.snapshot.consoleErrors).toEqual(['known-error']);
    expect(result.snapshot.failedResourceUrls).toEqual(['https://example.com/missing']);
  });

  it('passes completely on valid HTML and artifact/preview IPC boundary', async () => {
    const api = loadScript();
    const result = await api.run({
      projectId: 'audit',
      invoke: async (name: string, args: { kind?: string }) => {
        if (name === 'render_crawl_page') {
          return {
            html: '<h1>Example Domain</h1>',
            httpStatus: null,
            finalUrl: 'https://example.com/',
            contentType: 'text/html',
          };
        }
        if (name === 'capture_rendered_artifact') {
          const png = args?.kind === 'screenshot';
          return {
            artifactType: args?.kind,
            requestedUrl: 'https://example.com/',
            finalUrl: 'https://example.com/',
            runId: 'desktop-e2e-renderer',
            capturedAt: '2026-10-25T09:00:00Z',
            contentType: png ? 'image/png' : 'application/pdf',
            fileName: `rendered-page-20261025T090000Z-${args?.kind}.${png ? 'png' : 'pdf'}`,
            bytes: png ? 8 : 5,
            rendererPlatform: 'macos-wkwebview',
            dataBase64: png ? 'iVBORw0KGgo=' : 'JVBERi0=',
          };
        }
        if (name === 'open_rendered_element_preview') return;
        throw new Error(`Unexpected invoke ${name}`);
      },
    });

    expect(result.passed).toBe(true);
    expect(result.previewEvidence).toBe('ipc-success');
    expect(result.checks.length).toBeGreaterThanOrEqual(26);
    expect(result.checks).toContain('renderer HTML captured');
  });

  it('enforces strict output bounds on hostile/oversized payload', () => {
    const api = loadScript();
    const bad = 'x'.repeat(1_000_000);
    const diag = api.failureDiagnostics(
      {
        finalUrl: `https://example.com/${bad}`,
        contentType: bad,
        consoleErrors: Array(100).fill(bad),
        failedResourceUrls: Array(100).fill(`https://example.com/${bad}`),
      },
      bad
    );

    const serialized = JSON.stringify(diag);
    expect(serialized.length).toBeLessThan(65536);
    expect(diag.htmlSnippet.length).toBe(256);
    expect(diag.observedFinalUrl.length).toBe(2048);
    expect(diag.observedContentType.length).toBe(256);
    expect(diag.consoleErrors.length).toBe(10);
    expect(diag.consoleErrors[0].length).toBe(512);
    expect(diag.failedResourceUrls.length).toBe(10);
    expect(diag.failedResourceUrls[0].length).toBe(2048);
  });

  it('handles invocation error before page response gracefully', async () => {
    const api = loadScript();
    const result = await api.run({
      projectId: 'audit',
      invoke: async () => {
        throw new Error('IPC dispatch failed');
      },
    });

    expect(result.passed).toBe(false);
    expect(result.failure).toBe('Error: IPC dispatch failed');
    expect(result.snapshot.htmlLength).toBe(0);
    expect(result.snapshot.htmlSnippet).toBe('');
    expect(result.snapshot.observedFinalUrl).toBeNull();
  });
});
