(() => {
  const run = async ({ invoke, projectId }) => {
    const checks = [];
    const check = (name, value) => {
      if (!value) throw new Error(name);
      checks.push(name);
    };
    const reject = async (name, command, args, expected) => {
      let error;
      try { await invoke(command, args); } catch (caught) { error = String(caught); }
      check(name, error === expected);
    };
    const rejectMatch = async (name, command, args, pattern) => {
      let error;
      try { await invoke(command, args); } catch (caught) { error = String(caught); }
      check(name, typeof error === 'string' && pattern.test(error));
    };
    const loopback = 'http://127.0.0.1/';
    const previewArgs = {
      url: 'https://example.com/', needle: null, domIndex: null,
      previewTitle: 'E2E preview', notFoundMessage: 'E2E element was not found.',
    };
    try {
      const checkpointBefore = await invoke('load_project_crawl_checkpoint', { projectId });
      const queueBefore = await invoke('load_project_audit_queue', { projectId });
      await reject('unsupported public feed rejected', 'fetch_public_feed', {
        feed: 'unknown', geo: 'PL', keyword: 'seo', language: 'pl',
      }, 'Unsupported public feed.');
      await reject('invalid public feed geo rejected before network', 'fetch_public_feed', {
        feed: 'google-trends', geo: 'POL', keyword: 'seo', language: 'pl',
      }, 'Public feed requires a two-letter country.');
      await reject('unsupported AI provider rejected', 'test_ai_cli_connection', { provider: 'unsupported' }, 'Unsupported AI provider.');
      await reject('relative MCP server path rejected', 'discover_mcp_tools', { serverPath: 'relative-server.js' }, 'Choose an absolute path to a trusted MCP server JavaScript file.');
      await rejectMatch('invalid link URL rejected before network', 'check_link', { url: 'https://[invalid', timeoutSecs: 1 }, /Invalid link URL/);
      await reject('unsupported DataForSEO endpoint rejected', 'dataforseo_request', {
        projectId, path: '/v3/unsupported', payload: {},
      }, 'Unsupported DataForSEO endpoint.');
      await reject('invalid DataForSEO project rejected before credentials', 'dataforseo_request', {
        projectId: '../invalid', path: '/v3/appendix/user_data', payload: null,
      }, 'Invalid project identifier for DataForSEO request.');
      await reject('PageSpeed invalid project rejects loopback target', 'run_pagespeed_insights', {
        projectId: '../invalid', url: loopback, strategy: 'desktop',
      }, 'Invalid project identifier for Google performance request.');
      await reject('CrUX invalid project rejects loopback target', 'query_crux_record', {
        projectId: '../invalid', url: loopback, formFactor: 'DESKTOP', originScope: false,
      }, 'Invalid project identifier for Google performance request.');
      const renderArgs = {
        allowSubdomains: false, scopePath: null, waitForSelector: null,
        waitDelayMs: 0, lazyScrollCycles: 0,
      };
      await reject('render page loopback rejected', 'render_crawl_page', { ...renderArgs, url: loopback }, 'Access to local/private IP addresses is blocked for security (SSRF prevention)');
      await reject('rendered capture loopback rejected', 'capture_rendered_artifact', {
        ...renderArgs, url: loopback, kind: 'screenshot', runId: null,
      }, 'Access to local/private IP addresses is blocked for security (SSRF prevention)');
      await reject('rendered capture kind rejected', 'capture_rendered_artifact', {
        ...renderArgs, url: 'https://example.com/', kind: 'svg', runId: null,
      }, 'Rendered artifact kind must be screenshot or pdf.');
      await reject('rendered preview loopback rejected', 'open_rendered_element_preview', {
        ...previewArgs, url: loopback, selector: 'h1',
      }, 'Access to local/private IP addresses is blocked for security (SSRF prevention)');
      await reject('rendered preview selector rejected', 'open_rendered_element_preview', {
        ...previewArgs, selector: '',
      }, 'Preview selector cannot be empty.');
      await reject('invalid settings secret name rejected before secure store', 'set_secret', {
        name: 'invalid/name', value: 'unused',
      }, 'Unsupported secure setting.');
      await reject('invalid settings secret name read rejected before secure store', 'get_secret', {
        name: 'invalid/name',
      }, 'Unsupported secure setting.');
      await reject('invalid request profile rejected before secure store', 'save_crawl_auth_profile', {
        projectId: '../invalid', profileId: 'e2e', headers: [], cookie: null, proxyUrl: null,
      }, 'Invalid project or request-profile identifier.');
      await reject('invalid request profile deletion rejected before secure store', 'delete_crawl_auth_profile', {
        projectId: '../invalid', profileId: 'e2e',
      }, 'Invalid project or request-profile identifier.');
      await reject('invalid Search Console client rejected before OAuth', 'list_search_console_properties', {
        projectId, clientId: 'invalid-client-id',
      }, 'Enter a valid Desktop app OAuth Client ID from Google Cloud Console.');
      await reject('invalid Search Console performance client rejected before OAuth', 'search_console_performance', {
        projectId, clientId: 'invalid-client-id', siteUrl: 'https://example.com/', startDate: '2026-01-01', endDate: '2026-01-02', filters: null,
      }, 'Enter a valid Desktop app OAuth Client ID from Google Cloud Console.');
      await reject('invalid Search Console inspection client rejected before OAuth', 'inspect_search_console_url', {
        projectId, clientId: 'invalid-client-id', siteUrl: 'https://example.com/', inspectionUrl: 'https://example.com/',
      }, 'Enter a valid Desktop app OAuth Client ID from Google Cloud Console.');
      await reject('scheduler invalid project rejected', 'register_audit_wakeup', {
        projectId: '../invalid', scheduleId: 'schedule', nextRunAt: '2026-01-01T00:00:00Z', intervalHours: 24,
      }, 'Invalid project or schedule identifier.');
      await reject('queue scheduler invalid run rejected', 'register_audit_queue_wakeup', {
        projectId, runId: '../invalid', nextRunAt: '2026-01-01T00:00:00Z',
      }, 'Invalid project or queue run identifier.');
      await reject('audit queue invalid project rejected', 'load_project_audit_queue', { projectId: '../invalid' }, 'Invalid project identifier for crawl storage.');
      await reject('audit queue invalid run rejected', 'acknowledge_project_audit_queue_execution', {
        projectId, runId: '../invalid',
      }, 'Invalid audit queue run identifier.');
      await reject('audit queue invalid item rejected', 'acknowledge_project_audit_queue_result', {
        projectId, runId: 'run', itemId: '../invalid',
      }, 'Invalid audit queue result identifier.');
      await rejectMatch('invalid crawler URL rejected before network', 'crawl_site', {
        startUrl: 'https://[invalid', maxPages: 1, projectId,
      }, /URL|url|valid/i);
      await rejectMatch('updater check rejects fixture configuration before network', 'check_for_updates', {}, /Updater initialization/);
      await rejectMatch('updater install rejects fixture configuration before install', 'install_update', {}, /Updater initialization/);
      const checkpointAfter = await invoke('load_project_crawl_checkpoint', { projectId });
      const queueAfter = await invoke('load_project_audit_queue', { projectId });
      check('reject-first validation preserves crawl checkpoint', JSON.stringify(checkpointBefore) === JSON.stringify(checkpointAfter));
      check('reject-first validation preserves audit queue', JSON.stringify(queueBefore) === JSON.stringify(queueAfter));
      await window.__seomiDesktopAdditionalValidation.run({ invoke, projectId, check, reject });
      const workerInitiallyActive = await invoke('render_worker_status');
      check('render worker starts inactive', workerInitiallyActive === false);
      const lease = await invoke('start_render_worker');
      check('render worker lease uses loopback and one-shot contract', /^http:\/\/127\.0\.0\.1:\d+$/.test(lease?.baseUrl) && lease?.oneShot === true && typeof lease?.token === 'string' && lease.token.length > 0);
      check('render worker reports active after start', await invoke('render_worker_status') === true);
      await invoke('stop_render_worker');
      check('render worker reports inactive after stop', await invoke('render_worker_status') === false);
      const queueProjectId = `${projectId}-validation`;
      const queueSnapshot = { items: [], run: { id: 'validation', status: 'pending' } };
      await invoke('save_project_audit_queue', { projectId: queueProjectId, snapshot: queueSnapshot });
      check('isolated audit queue save succeeds', JSON.stringify(await invoke('load_project_audit_queue', { projectId: queueProjectId })) === JSON.stringify(queueSnapshot));
      check('isolated audit queue executions are readable', Array.isArray(await invoke('list_project_audit_queue_executions', { projectId: queueProjectId })));
      check('isolated audit queue results are readable', Array.isArray(await invoke('list_project_audit_queue_results', { projectId: queueProjectId })));
      await invoke('delete_project_audit_queue', { projectId: queueProjectId });
      check('isolated audit queue deletion is durable', await invoke('load_project_audit_queue', { projectId: queueProjectId }) === null);
      return { status: 'executed', passed: true, checks };
    } catch (error) {
      return { status: 'executed', passed: false, checks, failure: String(error) };
    }
  };
  window.__seomiDesktopValidation = { run };
})();
