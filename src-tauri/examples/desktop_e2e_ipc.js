(() => {
  // These contracts reject malformed IPC payloads before any command effects.
  const contracts = [
    ['test_ai_cli_connection', 'provider:s'],
    ['run_ai_cli', 'provider:s prompt:s model:o'],
    ['load_project_audit_queue', 'projectId:s'],
    ['save_project_audit_queue', 'projectId:s snapshot:v'],
    ['delete_project_audit_queue', 'projectId:s'],
    ['list_project_audit_queue_executions', 'projectId:s'],
    ['acknowledge_project_audit_queue_execution', 'projectId:s runId:s'],
    ['list_project_audit_queue_results', 'projectId:s'],
    ['acknowledge_project_audit_queue_result', 'projectId:s runId:s itemId:s'],
    ['load_project_crawl_runs', 'projectId:s'],
    ['save_project_crawl_runs', 'projectId:s crawlRuns:v'],
    ['load_project_crawl_checkpoint', 'projectId:s'],
    ['save_project_crawl_checkpoint', 'projectId:s checkpoint:v'],
    ['delete_project_crawl_checkpoint', 'projectId:s'],
    ['inspect_url', 'url:s userAgent:o timeoutSecs:o maxRedirects:o verifySsl:o requestId:o'],
    ['cancel_inspect_url', 'requestId:s'],
    ['check_link', 'url:s timeoutSecs:o'],
    ['check_external_crawl_links', 'requestId:s urls:a maxUrls:o'],
    ['fetch_public_feed', 'feed:s geo:s keyword:s language:s'],
    ['write_mcp_config_file', 'path:s contents:s'],
    ['discover_mcp_tools', 'serverPath:s'],
    ['save_config', 'config:j'],
    ['get_secret', 'name:s'],
    ['set_secret', 'name:s value:s'],
    ['save_crawl_auth_profile', 'projectId:s profileId:s headers:a cookie:o proxyUrl:o'],
    ['delete_crawl_auth_profile', 'projectId:s profileId:s'],
    ['dataforseo_request', 'projectId:s path:s payload:v'],
    ['run_pagespeed_insights', 'projectId:s url:s strategy:s'],
    ['query_crux_record', 'projectId:s url:s formFactor:s originScope:b'],
    ['connect_search_console', 'projectId:s clientId:s clientSecret:o'],
    ['list_search_console_properties', 'projectId:s clientId:s'],
    ['search_console_performance', 'projectId:s clientId:s siteUrl:s startDate:o endDate:o filters:p'],
    ['inspect_search_console_url', 'projectId:s clientId:s siteUrl:s inspectionUrl:s'],
    ['disconnect_search_console', 'projectId:s'],
    ['generate_audit_pdf', 'audit:v'],
    ['generate_crawl_pdf', 'run:v'],
    ['render_crawl_page', 'url:s allowSubdomains:b scopePath:o waitForSelector:o waitDelayMs:o lazyScrollCycles:o'],
    ['capture_rendered_artifact', 'url:s allowSubdomains:b scopePath:o waitForSelector:o waitDelayMs:o lazyScrollCycles:o kind:s runId:o'],
    ['open_rendered_element_preview', 'url:s selector:s needle:o domIndex:o previewTitle:s notFoundMessage:s'],
    ['register_audit_wakeup', 'projectId:s scheduleId:s nextRunAt:s intervalHours:n'],
    ['unregister_audit_wakeup', 'projectId:s scheduleId:s'],
    ['register_audit_queue_wakeup', 'projectId:s runId:s nextRunAt:s'],
    ['unregister_audit_queue_wakeup', 'projectId:s runId:s'],
    ['save_scheduled_task', 'projectId:s task:j'],
    ['delete_scheduled_task', 'projectId:s scheduleId:s'],
    ['load_scheduled_execution', 'projectId:s scheduleId:s'],
    ['list_scheduled_executions', 'projectId:s'],
    ['acknowledge_scheduled_execution', 'projectId:s scheduleId:s'],
    ['crawl_site', 'startUrl:s maxPages:o userAgent:o runId:o projectId:o config:p'],
    ['validate_crawl_filters', 'includePatterns:a excludePatterns:a previewUrls:a'],
    ['cancel_site_crawl', 'runId:s'],
    ['pause_site_crawl', 'runId:s'],
    ['resume_site_crawl', 'runId:s'],
  ];
  const run = async ({ invoke, check }) => {
    for (const [command, fields] of contracts) {
      const params = fields.split(' ').map(field => field.split(':'));
      const base = Object.fromEntries(params.map(([key, type]) => [key,
        type === 's' ? 'fixture' : (type === 'o' || type === 'p') ? null : type === 'a' ? [] : type === 'n' ? 1 : type === 'b' ? false : {},
      ]));
      for (const [key, type] of params) {
        if (type === 'v') continue;
        const args = { ...base, [key]: (type === 'b' || type === 'o') ? [] : false };
        let error;
        try { await invoke(command, args); } catch (caught) { error = String(caught); }
        check(`IPC ${command} rejects malformed ${key}`, typeof error === 'string'
          && error.includes(`invalid args \`${key}\` for command \`${command}\``));
      }
    }
  };
  window.__seomiDesktopIpcValidation = { run };
})();
