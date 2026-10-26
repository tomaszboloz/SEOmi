// Real local UI smoke checks for lazy entry chunks in the isolated Tauri WebView.
(() => {
  const MAX_DIAGNOSTIC_ENTRIES = 10;
  const recordDiagnostic = (entries, value) => {
    if (entries.length < MAX_DIAGNOSTIC_ENTRIES) entries.push(String(value).slice(0, 2048));
  };
  const consoleErrors = [];
  const nativeConsoleError = console.error.bind(console);
  console.error = (...args) => {
    recordDiagnostic(consoleErrors, args.slice(0, MAX_DIAGNOSTIC_ENTRIES).map((value) => String(value)).join(' '));
    nativeConsoleError(...args);
  };
  const runtimeErrors = [];
  window.addEventListener('error', (event) => recordDiagnostic(runtimeErrors, event.error || event.message));
  window.addEventListener('unhandledrejection', (event) => recordDiagnostic(runtimeErrors, event.reason));
  const modalCases = [
    { name: 'settings modal', trigger: () => document.querySelector('header button[aria-label="Settings"]'), dialog: '[role="dialog"][aria-labelledby="settings-modal-title"]', close: 'button[aria-label="Close settings"]' },
    { name: 'AI assistant modal', trigger: () => document.querySelector('header button[title="Open AI metadata and schema optimizer"]'), dialog: '[role="dialog"][aria-labelledby="ai-assistant-title"]', close: 'button[aria-label="Close AI assistant"]' },
    { name: 'AI connections modal', trigger: () => document.querySelector('header button[title^="Direct AI subscriptions"]'), dialog: '[role="dialog"][aria-labelledby="ai-connections-title"]', close: 'button[aria-label="Close AI connections"]' },
    { name: 'history modal', trigger: () => document.querySelector('header button[title="Recent Audits"]'), dialog: '[role="dialog"][aria-labelledby="audit-history-title"]', close: 'button[aria-label="Close audit history"]' },
    { name: 'command palette', trigger: () => document.querySelector('header button[aria-label="Open quick navigation"]'), dialog: '#command-palette-dialog', close: 'button[aria-label="Close quick navigation"]' },
  ];
  const sidebarTabs = [
    'overview', 'site-audit', 'keyword-research', 'saved-keywords', 'keyword-clustering',
    'rank-tracking', 'domain-overview', 'backlink-checker', 'core-web-vitals', 'search-console',
    'dataforseo', 'ai-brand-visibility', 'ai-search-prompts', 'mcp-hub', 'seo-tools',
  ];
  const rootError = () => {
    const node = document.querySelector('main[role="alert"]');
    const text = node?.querySelector('pre')?.textContent || node?.textContent;
    return text?.trim().slice(0, 2048) || null;
  };
  const routeError = () => {
    const node = document.querySelector('main > section[role="alert"]');
    return node?.textContent?.trim().slice(0, 2048) || null;
  };
  const runtimeError = () => rootError() || routeError();
  const waitFor = async (predicate, name) => {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const failure = runtimeError();
      if (failure) throw new Error(`ui-runtime-error: ${failure}`);
      const value = predicate();
      if (value) return value;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`timeout: ${name}`);
  };
  const click = async (target, name) => {
    const element = await waitFor(() => typeof target === 'function' ? target() : document.querySelector(target), `${name} trigger`);
    element.click();
    return element;
  };
  const run = async ({ progress } = {}) => {
    const checks = [];
    const check = (name, value) => {
      if (!value) throw new Error(name);
      checks.push(name);
    };
    const smokeModal = async ({ name, trigger, dialog, close }) => {
      await click(trigger, name);
      const element = await waitFor(() => document.querySelector(dialog), `${name} dialog`);
      check(`${name} lazy dialog rendered`, Boolean(element));
      await click(() => element.querySelector(close), `${name} close`);
      await waitFor(() => !document.querySelector(dialog), `${name} close`);
    };
    try {
      for (const modal of modalCases) {
        progress?.(`UI opening ${modal.name}`);
        await smokeModal(modal);
      }
      progress?.('UI opening create project');
      await click(modalCases[4].trigger, 'create project palette');
      await click('#command-palette-option-new-project', 'create project command');
      const createDialog = await waitFor(() => document.querySelector('[role="dialog"][aria-labelledby="create-project-title"]'), 'create project dialog');
      check('create project lazy dialog rendered', Boolean(createDialog));
      await click(() => createDialog.querySelector('button[aria-label="Close project creation"]'), 'create project close');
      await waitFor(() => !document.querySelector('[role="dialog"][aria-labelledby="create-project-title"]'), 'create project close');
      for (const tab of sidebarTabs) {
        progress?.(`UI navigating ${tab}`);
        const selector = `[data-sidebar-tab="${tab}"]`;
        await click(selector, `sidebar ${tab}`);
        await waitFor(() => document.querySelector(`${selector}[aria-current="page"]`)
          && !document.querySelector('main > div[role="status"]'), `sidebar ${tab} render`);
        check(`sidebar lazy route ${tab} rendered`, !routeError());
      }
      return { status: 'executed', passed: true, checks, consoleErrors: consoleErrors.slice(0, 10), runtimeErrors: runtimeErrors.slice(0, 10) };
    } catch (error) {
      return {
        status: 'executed',
        passed: false,
        checks,
        failure: String(error),
        rootError: rootError(),
        routeError: routeError(),
        consoleErrors: consoleErrors.slice(0, 10),
        runtimeErrors: runtimeErrors.slice(0, 10),
      };
    }
  };
  window.__seomiDesktopUiSmoke = { run };
})();
