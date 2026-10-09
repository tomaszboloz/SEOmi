(() => {
  const pdfPayload = value => typeof value === 'string' && value.startsWith('JVBERi0');
  const run = async ({ invoke, projectId, check, reject }) => {
    const runsProjectId = `${projectId}-runs`;
    const crawlRuns = [{ id: 'desktop-e2e-run', scope_start_url: 'https://example.com/', result: { pages: [] } }];
    await invoke('save_project_crawl_runs', { projectId: runsProjectId, crawlRuns });
    const loadedRuns = await invoke('load_project_crawl_runs', { projectId: runsProjectId });
    check('crawl run history round trip', Array.isArray(loadedRuns) && loadedRuns.length === 1 && loadedRuns[0].id === crawlRuns[0].id && loadedRuns[0].scope_start_url === crawlRuns[0].scope_start_url && Array.isArray(loadedRuns[0].result?.pages) && loadedRuns[0].result.pages.length === 0);
    await reject('crawl run storage rejects non-array', 'save_project_crawl_runs', { projectId: runsProjectId, crawlRuns: {} }, 'Crawl run storage expects a JSON array.');

    const links = await invoke('check_external_crawl_links', { requestId: 'desktop-e2e-empty-links', urls: [], maxUrls: 1 });
    check('empty external-link batch is deterministic', links.requested === 0 && links.checked === 0 && links.omitted === 0 && Array.isArray(links.results) && links.results.length === 0);
    const auditPdf = await invoke('generate_audit_pdf', { audit: { final_url: 'https://example.com/', issues: [] } });
    check('minimal audit PDF has a PDF payload', pdfPayload(auditPdf));
    const crawlPdf = await invoke('generate_crawl_pdf', { run: { scope_start_url: 'https://example.com/', result: { pages: [] } } });
    check('minimal crawl PDF has a PDF payload', pdfPayload(crawlPdf));
    await reject('MCP export rejects relative path', 'write_mcp_config_file', { path: 'desktop-e2e.json', contents: '{}' }, 'The selected export path must be absolute.');
    const detected = await invoke('detect_ai_clis');
    check('AI CLI detection returns the supported providers', Array.isArray(detected) && detected.length === 3 && detected.every(item => ['openai', 'claude', 'gemini'].includes(item.provider)));
    await reject('AI CLI rejects an empty prompt before process launch', 'run_ai_cli', { provider: 'unsupported', prompt: '', model: null }, 'Prompt cannot be empty.');
    await reject('Search Console connect rejects invalid client before OAuth', 'connect_search_console', { projectId, clientId: 'invalid-client-id', clientSecret: null }, 'Enter a valid Desktop app OAuth Client ID from Google Cloud Console.');
    await reject('Search Console connect rejects invalid project before credential access', 'connect_search_console', { projectId: '../invalid', clientId: 'fixture.apps.googleusercontent.com', clientSecret: null }, 'Invalid Google Search Console project identifier.');
    await reject('Search Console properties reject invalid project before credential access', 'list_search_console_properties', { projectId: '../invalid', clientId: 'fixture.apps.googleusercontent.com' }, 'Invalid Google Search Console project identifier.');
    await reject('Search Console performance rejects invalid project before credential access', 'search_console_performance', { projectId: '../invalid', clientId: 'fixture.apps.googleusercontent.com', siteUrl: 'https://example.com/', startDate: null, endDate: null, filters: null }, 'Invalid Google Search Console project identifier.');
    await reject('Search Console inspection rejects invalid project before credential access', 'inspect_search_console_url', { projectId: '../invalid', clientId: 'fixture.apps.googleusercontent.com', siteUrl: 'https://example.com/', inspectionUrl: 'https://example.com/' }, 'Invalid Google Search Console project identifier.');
    await reject('Search Console disconnect rejects invalid project', 'disconnect_search_console', { projectId: '../invalid' }, 'Invalid Google Search Console project identifier.');

    const scheduledTask = { scheduleId: 'e2e', url: 'https://example.com/', taskType: 'page-audit', intervalHours: 24, enabled: true, status: 'scheduled', createdAt: '2026-01-01T00:00:00Z', nextRunAt: '2026-01-02T00:00:00Z', runHistory: [] };
    await reject('scheduled task save rejects invalid project', 'save_scheduled_task', { projectId: '../invalid', task: scheduledTask }, 'Invalid project or schedule identifier.');
    await reject('scheduled task delete rejects invalid project', 'delete_scheduled_task', { projectId: '../invalid', scheduleId: 'e2e' }, 'Invalid project or schedule identifier.');
    await reject('scheduled execution load rejects invalid project', 'load_scheduled_execution', { projectId: '../invalid', scheduleId: 'e2e' }, 'Invalid project or schedule identifier.');
    await reject('scheduled execution list rejects invalid project', 'list_scheduled_executions', { projectId: '../invalid' }, 'Invalid project identifier.');
    await reject('scheduled execution acknowledgement rejects invalid project', 'acknowledge_scheduled_execution', { projectId: '../invalid', scheduleId: 'e2e' }, 'Invalid project or schedule identifier.');
    await reject('scheduler unregister rejects invalid project', 'unregister_audit_wakeup', { projectId: '../invalid', scheduleId: 'e2e' }, 'Invalid project or schedule identifier.');
    await reject('queue scheduler unregister rejects invalid run', 'unregister_audit_queue_wakeup', { projectId, runId: '../invalid' }, 'Invalid project or queue run identifier.');
    check('scheduled launch context is available through IPC', typeof await invoke('scheduled_launch_context') === 'object');
    check('audit cancellation is accepted before a request starts', await invoke('cancel_inspect_url', { requestId: 'desktop-e2e-cancel' }) === true);
    await invoke('cancel_site_crawl', { runId: 'desktop-e2e-crawl-control' });
    await reject('paused cancelled crawl is rejected', 'pause_site_crawl', { runId: 'desktop-e2e-crawl-control' }, 'Cannot pause a cancelled crawl.');
    await invoke('resume_site_crawl', { runId: 'desktop-e2e-crawl-control' });
  };
  window.__seomiDesktopAdditionalValidation = { run };
})();
