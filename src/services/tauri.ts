import { AiCliStatus, AppConfig, CrawlFilterValidationError, CrawlFilterValidationResult, RenderedPageArtifact } from '@/types';
import { readStorage } from '@/services/storage';
import i18n from '@/i18n';

export interface UpdateStatus {
  available: boolean;
  installed: boolean;
  restart_required: boolean;
  version: string | null;
  current_version: string;
}

export const isTauriEnvironment = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export interface SaveTextFileOptions {
  defaultPath: string;
  contents: string;
  extension: 'json' | 'toml';
  filterName: string;
}

/**
 * Saves a user-selected text export through the native system dialog when the
 * desktop shell is present. Browser preview keeps the same explicit action by
 * downloading the file, without pretending that Web Storage is a safe file
 * system or forwarding credentials anywhere.
 */
export async function saveTextFile(options: SaveTextFileOptions): Promise<'saved' | 'cancelled' | 'downloaded'> {
  if (!isTauriEnvironment()) {
    const url = URL.createObjectURL(new Blob([options.contents], { type: `${options.extension === 'json' ? 'application/json' : 'text/plain'};charset=utf-8` }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = options.defaultPath;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Let the browser start the download before releasing the object URL. A
    // synchronous revoke is ignored by some WebView engines and can produce
    // an empty export even though the click was dispatched successfully.
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    return 'downloaded';
  }

  const { save } = await import('@tauri-apps/plugin-dialog');
  const path = await save({
    defaultPath: options.defaultPath,
    filters: [{ name: options.filterName, extensions: [options.extension] }],
  });
  if (!path) return 'cancelled';
  await invokeTauriCommand('write_mcp_config_file', { path, contents: options.contents });
  return 'saved';
}

export async function invokeTauriCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauriEnvironment()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>(cmd, args);
  }
  return handleBrowserFallback<T>(cmd, args);
}

export async function getSecureValue(name: string): Promise<string> {
  const value = await invokeTauriCommand<string | null>('get_secret', { name });
  return value || '';
}

export async function setSecureValue(name: string, value: string): Promise<void> {
  await invokeTauriCommand('set_secret', { name, value });
}

export async function captureRenderedArtifact(args: {
  url: string;
  allowSubdomains: boolean;
  scopePath?: string;
  waitForSelector?: string;
  waitDelayMs?: number;
  lazyScrollCycles?: number;
  kind: 'screenshot' | 'pdf';
  runId?: string;
}): Promise<RenderedPageArtifact> {
  return invokeTauriCommand<RenderedPageArtifact>('capture_rendered_artifact', {
    url: args.url,
    allowSubdomains: args.allowSubdomains,
    scopePath: args.scopePath || null,
    waitForSelector: args.waitForSelector || null,
    waitDelayMs: args.waitDelayMs ?? 0,
    lazyScrollCycles: args.lazyScrollCycles ?? 0,
    kind: args.kind,
    runId: args.runId || null,
  });
}

export async function openRenderedElementPreview(args: {
  url: string;
  selector: string;
  needle?: string;
  /** Zero-based index inside querySelectorAll(selector), useful for controls
   * whose DOM nodes have no stable id/name or visible text. */
  domIndex?: number;
}): Promise<void> {
  const host = (() => {
    try { return new URL(args.url).host; } catch { return ''; }
  })();
  await invokeTauriCommand('open_rendered_element_preview', {
    url: args.url,
    selector: args.selector,
    needle: args.needle || null,
    domIndex: Number.isInteger(args.domIndex) && (args.domIndex as number) >= 0 ? args.domIndex : null,
    previewTitle: i18n.t('componentUi.previewWindowTitle', { host }),
    notFoundMessage: i18n.t('componentUi.previewNotFound'),
  });
}

export interface RenderWorkerLease {
  baseUrl: string;
  token: string;
  version: string;
  expiresAt: string;
  oneShot: boolean;
}

/**
 * Starts the explicit, loopback-only renderer bridge. The lease is intentionally
 * one-shot and short-lived; callers must not persist the token or expose it in
 * a URL/log. The worker is optional and is never installed or started in the
 * background.
 */
export function startRenderWorker(): Promise<RenderWorkerLease> {
  return invokeTauriCommand<RenderWorkerLease>('start_render_worker');
}

export function stopRenderWorker(): Promise<void> {
  return invokeTauriCommand<void>('stop_render_worker');
}

export function getRenderWorkerStatus(): Promise<boolean> {
  return invokeTauriCommand<boolean>('render_worker_status');
}

function handleBrowserFallback<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
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
    const includePatterns = Array.isArray(args?.includePatterns)
      ? args.includePatterns.filter((value): value is string => typeof value === 'string')
      : [];
    const excludePatterns = Array.isArray(args?.excludePatterns)
      ? args.excludePatterns.filter((value): value is string => typeof value === 'string')
      : [];
    const previewUrls = Array.isArray(args?.previewUrls)
      ? args.previewUrls.filter((value): value is string => typeof value === 'string').filter((value) => value.trim()).slice(0, 500)
      : [];
    const errors: CrawlFilterValidationError[] = [];
    const compile = (patterns: string[], filter: 'include' | 'exclude'): RegExp[] => patterns.flatMap((pattern) => {
      if ([...pattern].length > 2048) {
        errors.push({ filter, pattern, message: i18n.t('runtimeErrors.tauri.patternTooLong') });
        return [];
      }
      try {
        return [new RegExp(pattern)];
      } catch (error) {
        errors.push({ filter, pattern, message: error instanceof Error ? error.message : i18n.t('runtimeErrors.tauri.invalidRegex') });
        return [];
      }
    });
    const include = compile(includePatterns, 'include');
    const exclude = compile(excludePatterns, 'exclude');
    if (errors.length) return Promise.resolve({ valid: false, errors, previews: [] } as T);
    const previews = previewUrls.map((url) => {
      const includedByInclude = include.length === 0 || include.some((pattern) => pattern.test(url));
      const excludedByExclude = exclude.some((pattern) => pattern.test(url));
      return !includedByInclude
        ? { url, included: false, reason: i18n.t('runtimeErrors.tauri.notIncluded') }
        : excludedByExclude
          ? { url, included: false, reason: i18n.t('runtimeErrors.tauri.excluded') }
          : { url, included: true, reason: i18n.t('runtimeErrors.tauri.accepted') };
    });
    return Promise.resolve({ valid: true, errors: [], previews } satisfies CrawlFilterValidationResult as T);
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
