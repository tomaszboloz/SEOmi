import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import en from '../src/i18n/locales/en.json';

const sourceFile = resolve(process.cwd(), 'src-tauri/examples/desktop_e2e_ui.js');
const source = readFileSync(sourceFile, 'utf8');
const sidebarTabs = [
  'overview', 'site-audit', 'keyword-research', 'saved-keywords', 'keyword-clustering',
  'rank-tracking', 'domain-overview', 'backlink-checker', 'core-web-vitals', 'search-console',
  'dataforseo', 'ai-brand-visibility', 'ai-search-prompts', 'mcp-hub', 'seo-tools',
];

export type UiResult = {
  status: string;
  passed: boolean;
  checks: string[];
  failure?: string;
  rootError?: string | null;
  routeError?: string | null;
  consoleErrors?: string[];
  runtimeErrors?: string[];
};
type UiApi = { run: () => Promise<UiResult> };
type HarnessOptions = { routeErrorTab?: string };
type TestDom = { document: Document };

export const createDom = (body: string): TestDom => {
  const testDocument = document.implementation.createHTMLDocument('desktop-e2e');
  testDocument.body.innerHTML = body;
  return { document: testDocument };
};

export function execute(dom: TestDom, consoleErrors: string[]) {
  const nativeConsole = {
    error: (...values: unknown[]) => consoleErrors.push(values.map(String).join(' ')),
  };
  vm.runInNewContext(source, {
    window,
    document: dom.document,
    console: nativeConsole,
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
    Promise,
    Date,
  }, { filename: sourceFile });
  return {
    api: (window as unknown as { __seomiDesktopUiSmoke: UiApi }).__seomiDesktopUiSmoke,
    console: nativeConsole,
  };
}

export function createHarness(options: HarnessOptions = {}) {
  const dom = createDom('<header></header><main></main>');
  const { document } = dom;
  const main = document.querySelector('main');
  if (!main) throw new Error('test harness main element missing');
  document.querySelector('header')!.innerHTML = [
    `<button aria-label="${en.sidebar.settings}" type="button">Settings</button>`,
    `<button title="${en.header.aiOptimizerTitle}" type="button">AI</button>`,
    `<button title="${en.header.aiConnectionTitle}" type="button">Connections</button>`,
    `<button title="${en.urlBar.history}" type="button">History</button>`,
    `<button aria-label="${en.header.openQuickNavigation}" type="button">Navigate</button>`,
  ].join('');
  main.innerHTML = sidebarTabs.map((tab, index) =>
    `<button type="button" data-sidebar-tab="${tab}"${index === 0 ? ' aria-current="page"' : ''}>${tab}</button>`
  ).join('');
  const modalDefinitions = [
    { trigger: `header button[aria-label="${en.sidebar.settings}"]`, labelledBy: 'settings-modal-title', close: en.settings.close },
    { trigger: `header button[title="${en.header.aiOptimizerTitle}"]`, labelledBy: 'ai-assistant-title', close: en.ai.close },
    { trigger: `header button[title^="${en.header.aiConnectionTitle}"]`, labelledBy: 'ai-connections-title', close: en.auth.closeConnections },
    { trigger: `header button[title="${en.urlBar.history}"]`, labelledBy: 'audit-history-title', close: en.urlBar.closeHistory },
    { trigger: `header button[aria-label="${en.header.openQuickNavigation}"]`, labelledBy: 'command-palette-title', dialogId: 'command-palette-dialog', close: en.commandPalette.close, commandPalette: true },
  ];
  const openDialog = (definition: (typeof modalDefinitions)[number]) => {
    document.querySelectorAll('[role="dialog"]').forEach(node => node.remove());
    const option = definition.commandPalette
      ? '<button id="command-palette-option-new-project" type="button">New project</button>'
      : '';
    const title = definition.commandPalette ? '' : `<h2 id="${definition.labelledBy}">${definition.labelledBy}</h2>`;
    const id = definition.dialogId ? ` id="${definition.dialogId}"` : '';
    document.body.insertAdjacentHTML('beforeend', `<div${id} role="dialog" aria-labelledby="${definition.labelledBy}">${title}${option}<button type="button" aria-label="${definition.close}">Close</button></div>`);
  };
  document.addEventListener('click', event => {
    const target = event.target as Element | null;
    if (!target || typeof target.closest !== 'function') return;
    const modal = modalDefinitions.find(definition => target.closest(definition.trigger));
    if (modal) {
      openDialog(modal);
      return;
    }
    if (target.closest('#command-palette-option-new-project')) {
      document.querySelector('#command-palette-dialog')?.remove();
      document.body.insertAdjacentHTML(
        'beforeend',
        `<div role="dialog" aria-labelledby="create-project-title"><h2 id="create-project-title">Create project</h2><button type="button" aria-label="${en.projects.closeCreate}">Close</button></div>`,
      );
      return;
    }
    if (target.closest('button[aria-label^="Close"]')) {
      target.closest('[role="dialog"]')?.remove();
      return;
    }
    const tab = sidebarTabs.find(value => target.closest(`[data-sidebar-tab="${value}"]`));
    if (tab) {
      document.querySelectorAll('[data-sidebar-tab]').forEach(button => button.removeAttribute('aria-current'));
      target.closest(`[data-sidebar-tab="${tab}"]`)!.setAttribute('aria-current', 'page');
      main.querySelector('section[role="alert"]')?.remove();
      if (options.routeErrorTab === tab) {
        main.insertAdjacentHTML('beforeend', '<section role="alert">Nie udało się wyrenderować tej trasy</section>');
      }
    }
  });
  const consoleErrors: string[] = [];
  const { api } = execute(dom, consoleErrors);
  return { api, consoleErrors, dom };
}
