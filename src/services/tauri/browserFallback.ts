import type { AiCliStatus, AppConfig } from '@/types';
import { readStorage } from '@/services/storage';
import i18n from '@/i18n';
import { validateBrowserCrawlFilters } from './filters';

export function handleBrowserFallback<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  // Credentials belong in the native keychain/credential manager. The browser
  // preview must stay usable without pretending local storage is secure: return
  // an empty value and keep writes as an explicit no-op until the desktop shell
  // is available.
  if (cmd === 'get_secret') return Promise.resolve(null as T);
  if (cmd === 'set_secret') return Promise.resolve(undefined as T);
  if (cmd === 'detect_ai_clis') {
    const detail = i18n.t('runtimeErrors.tauri.localCliDesktop');
    const statuses: AiCliStatus[] = [
      { provider: 'openai', command: 'codex', available: false, detail },
      { provider: 'claude', command: 'claude', available: false, detail },
      { provider: 'gemini', command: 'gemini', available: false, detail },
    ];
    return Promise.resolve(statuses as T);
  }
  if (cmd === 'inspect_url') {
    return Promise.reject(new Error(i18n.t('runtimeErrors.tauri.urlAnalysisDesktop')));
  }
  if (cmd === 'get_config') {
    const config: AppConfig = {
      theme: 'dark',
      language: readStorage('seomi_language') || 'en',
      default_user_agent: 'chrome_mac',
      request_timeout_secs: 15,
      max_redirects: 10,
      verify_ssl: true,
      ai_provider: 'openai',
      ai_model: 'gpt-4o',
      auto_check_updates: true,
      auto_install_updates: false,
    };
    return Promise.resolve(config as T);
  }
  if (cmd === 'save_config') return Promise.resolve(undefined as T);
  if (cmd === 'validate_crawl_filters') {
    return validateBrowserCrawlFilters(args) as Promise<T>;
  }
  if (cmd === 'check_for_updates') return Promise.reject(new Error(i18n.t('runtimeErrors.tauri.updatesDesktop')));
  if (cmd === 'install_update') return Promise.reject(new Error(i18n.t('runtimeErrors.tauri.updatesDesktop')));
  if (cmd === 'capture_rendered_artifact') return Promise.reject(new Error(i18n.t('runtimeErrors.tauri.renderedOnly')));
  if (cmd === 'open_rendered_element_preview') return Promise.reject(new Error(i18n.t('runtimeErrors.tauri.previewDesktop')));
  if (cmd === 'start_render_worker' || cmd === 'stop_render_worker' || cmd === 'render_worker_status') {
    return Promise.reject(new Error(i18n.t('runtimeErrors.tauri.workerDesktop')));
  }
  if (cmd === 'register_audit_wakeup' || cmd === 'unregister_audit_wakeup' || cmd === 'scheduled_launch_context'
    || cmd === 'register_audit_queue_wakeup' || cmd === 'unregister_audit_queue_wakeup'
    || cmd === 'save_scheduled_task' || cmd === 'delete_scheduled_task'
    || cmd === 'load_scheduled_execution' || cmd === 'list_scheduled_executions'
    || cmd === 'acknowledge_scheduled_execution') {
    return Promise.reject(new Error(i18n.t('runtimeErrors.tauri.scheduleDesktop')));
  }
  // The browser preview deliberately does not emulate native networking,
  // crawl, keychain, process, or filesystem commands. Keep every known IPC
  // action explicit so a route interaction cannot leak an implementation-level
  // "unknown command" error to the user.
  const desktopOnlyCommands = new Set([
    'cancel_inspect_url',
    'cancel_site_crawl',
    'check_link',
    'check_external_crawl_links',
    'connect_search_console',
    'crawl_site',
    'dataforseo_request',
    'fetch_public_feed',
    'delete_crawl_auth_profile',
    'discover_mcp_tools',
    'load_project_audit_queue',
    'list_project_audit_queue_executions',
    'acknowledge_project_audit_queue_execution',
    'list_project_audit_queue_results',
    'acknowledge_project_audit_queue_result',
    'disconnect_search_console',
    'inspect_search_console_url',
    'list_search_console_properties',
    'load_project_crawl_runs',
    'load_project_crawl_checkpoint',
    'pause_site_crawl',
    'query_crux_record',
    'resume_site_crawl',
    'run_ai_cli',
    'run_pagespeed_insights',
    'save_crawl_auth_profile',
    'save_project_audit_queue',
    'save_project_crawl_checkpoint',
    'save_project_crawl_runs',
    'delete_project_audit_queue',
    'delete_project_crawl_checkpoint',
    'generate_audit_pdf',
    'generate_crawl_pdf',
    'save_scheduled_task',
    'delete_scheduled_task',
    'load_scheduled_execution',
    'list_scheduled_executions',
    'acknowledge_scheduled_execution',
    'search_console_performance',
    'write_mcp_config_file',
  ]);
  if (desktopOnlyCommands.has(cmd)) {
    return Promise.reject(new Error(i18n.t('runtimeErrors.tauri.desktopOnly')));
  }
  return Promise.reject(new Error(i18n.t('runtimeErrors.tauri.unknownCommand', { command: cmd })));
}
