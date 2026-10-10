// Live crawl checks run only when the renderer-enabled desktop E2E is requested.
(() => {
  const target = 'https://example.com/';
  const nonce = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const crawlConfig = mode => ({
    crawlMode: mode,
    maxPages: 1,
    maxDepth: 0,
    maxRunSeconds: 30,
    requestTimeoutSecs: 10,
    respectRobots: true,
    respectCrawlDelay: false,
    discoverSitemaps: false,
    crawlImages: false,
    crawlStylesheets: false,
    crawlScripts: false,
    crawlOtherResources: false,
    maxConcurrentRequests: 1,
  });
  const checkLivePage = (label, mode, result, check) => {
    const page = result?.pages?.length === 1 ? result.pages[0] : null;
    check(`${label} crawl mode is exact`, result?.crawl_mode === mode);
    check(`${label} crawl returns one page`, page !== null);
    check(`${label} crawl completed without cancellation or timeout`, result?.cancelled === false && result?.timed_out === false);
    let finalUrl;
    try { finalUrl = new URL(page?.final_url); } catch (_) { finalUrl = null; }
    check(`${label} observed final URL is example.com`, finalUrl?.hostname === 'example.com');
    check(`${label} observed HTTP status is positive`, Number.isInteger(page?.http_status) && page.http_status > 0);
    check(`${label} observed response time is an integer`, Number.isInteger(page?.response_time_ms) && page.response_time_ms >= 0);
    check(`${label} live HTML content type is present`, typeof page?.content_type === 'string' && page.content_type.toLowerCase().includes('text/html'));
    check(`${label} live HTML title is present`, page?.title === 'Example Domain');
    check(`${label} live HTML has parsed words`, Number.isInteger(page?.word_count) && page.word_count > 0);
    const source = page?.semantic_content_source;
    check(`${label} semantic source identifies HTML evidence`, source === 'primary-root' || source === 'body-fallback');
    const provenance = page?.semantic_content_provenance;
    check(`${label} semantic provenance matches crawl mode`, mode === 'http' ? provenance === 'http' : provenance === 'rendered' || provenance === 'http');
  };
  const run = async ({ invoke, projectId, check }) => {
    const token = nonce();
    const runCase = async (label, mode) => {
      const result = await invoke('crawl_site', {
        startUrl: target,
        maxPages: 1,
        runId: `desktop-e2e-${mode}-${token}`,
        projectId: `${projectId}-renderer-${mode}-${token}`,
        config: crawlConfig(mode),
      });
      checkLivePage(label, mode, result, check);
      return result;
    };
    return {
      http: await runCase('HTTP', 'http'),
      rendered: await runCase('browser-rendered', 'browser-rendered'),
    };
  };
  window.__seomiDesktopCrawlValidation = { run };
})();
