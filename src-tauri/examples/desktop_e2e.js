(async () => {
  if (window.__seomiE2eRunning) return;
  window.__seomiE2eRunning = true;
  const invoke = window.__TAURI_INTERNALS__.invoke;
  const rendererEnabled = window.__seomiE2eRendererEnabled === true;
  const checks = JSON.parse(sessionStorage.getItem('seomi-e2e-checks') || '[]');
  const check = (name, value) => {
    if (!value) throw new Error(name);
    checks.push(name);
  };
  const waitFor = async (predicate, name) => {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const value = predicate();
      if (value) return value;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`timeout: ${name}`);
  };
  const reject = async (name, command, args, pattern) => {
    let error;
    try { await invoke(command, args); } catch (caught) { error = String(caught); }
    check(name, typeof error === 'string' && pattern.test(error));
  };
  const fill = (input, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const select = (input, value) => {
    input.value = value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const report = async payload => invoke('plugin:event|emit', { event: 'seomi-desktop-e2e-result', payload });
  let renderer = null;
  let validation = null;
  try {
    check('real native IPC environment', !!window.__TAURI_INTERNALS__ && !!window.__TAURI__);
    if (!sessionStorage.getItem('seomi-e2e-stage')) {
      check('isolated empty webview profile', localStorage.getItem('seomi_projects_v1') === null);
      const config = await invoke('get_config');
      check('native configuration loaded', config.request_timeout_secs > 0);
      const changed = { ...config, theme: 'light', auto_check_updates: false, auto_install_updates: false };
      await invoke('save_config', { config: changed });
      check('native configuration round trip', (await invoke('get_config')).theme === 'light');
      await reject('invalid config rejected', 'save_config', { config: { ...changed, request_timeout_secs: 0 } }, /timeout/i);
      check('rejected config retains prior snapshot', (await invoke('get_config')).request_timeout_secs === changed.request_timeout_secs);
      await reject('audit SSRF rejected through IPC', 'inspect_url', { url: 'http://127.0.0.1/' }, /private|loopback|local/i);
      await reject('crawler SSRF rejected through IPC', 'crawl_site', { startUrl: 'http://127.0.0.1/', maxPages: 1 }, /private|loopback|local/i);
      await reject('link SSRF rejected through IPC', 'check_link', { url: 'http://127.0.0.1/' }, /private|loopback|local/i);
      await reject('storage traversal rejected', 'load_project_crawl_checkpoint', { projectId: '../outside' }, /identifier/i);
      const invalid = await invoke('validate_crawl_filters', { includePatterns: ['['], excludePatterns: [], previewUrls: [] });
      check('native invalid regex returns validation evidence', invalid.valid === false && invalid.errors.length === 1);
      const valid = await invoke('validate_crawl_filters', { includePatterns: [], excludePatterns: [], previewUrls: ['https://example.com/'] });
      check('native filter success path', valid.valid && valid.previews[0].included);
      const form = await waitFor(() => document.querySelector('main form'), 'project gate');
      check('project gate rendered', form.querySelectorAll('input').length === 2);
      fill(form.querySelectorAll('input')[0], 'Desktop E2E First');
      fill(form.querySelectorAll('input')[1], 'http://127.0.0.1/');
      form.querySelector('button[type=submit]').click();
      await waitFor(() => form.querySelector('[role=alert]'), 'project URL validation');
      check('invalid project stays at gate', localStorage.getItem('seomi_projects_v1') === null);
      fill(form.querySelectorAll('input')[1], 'https://example.com/');
      form.querySelector('button[type=submit]').click();
      const switcher = await waitFor(() => document.querySelector('#workspace-project-switcher'), 'workspace after creation');
      const projectId = switcher.value;
      check('project created through rendered form', projectId && JSON.parse(localStorage.getItem('seomi_projects_v1'))[0].name === 'Desktop E2E First');
      sessionStorage.setItem('seomi-e2e-project', projectId);
      const checkpoint = { fixture: 'desktop-e2e-persistence', projectId };
      await invoke('save_project_crawl_checkpoint', { projectId, checkpoint });
      check('checkpoint native round trip', (await invoke('load_project_crawl_checkpoint', { projectId })).fixture === checkpoint.fixture);
      await reject('invalid checkpoint rejected', 'save_project_crawl_checkpoint', { projectId, checkpoint: [] }, /object/i);
      check('rejected checkpoint preserves previous file', (await invoke('load_project_crawl_checkpoint', { projectId })).fixture === checkpoint.fixture);
      sessionStorage.setItem('seomi-e2e-checks', JSON.stringify(checks));
      sessionStorage.setItem('seomi-e2e-stage', 'reload');
      location.reload();
      return;
    }
    const projectId = sessionStorage.getItem('seomi-e2e-project');
    const switcher = await waitFor(() => document.querySelector('#workspace-project-switcher'), 'persisted workspace after reload');
    check('reload restores active project and rendered workspace', switcher.value === projectId);
    check('reload retains native checkpoint', (await invoke('load_project_crawl_checkpoint', { projectId })).fixture === 'desktop-e2e-persistence');
    select(switcher, '__create_project__');
    const dialog = await waitFor(() => document.querySelector('[role=dialog] form'), 'second project form');
    fill(dialog.querySelectorAll('input')[0], 'Desktop E2E Second');
    fill(dialog.querySelectorAll('input')[1], 'https://example.org/');
    dialog.querySelector('button[type=submit]').click();
    const secondSwitcher = await waitFor(() => {
      const current = document.querySelector('#workspace-project-switcher');
      return current && current.value && current.value !== projectId && current.value !== '__create_project__' ? current : null;
    }, 'second active project');
    const secondId = secondSwitcher.value;
    check('new project has isolated native persistence', await invoke('load_project_crawl_checkpoint', { projectId: secondId }) === null);
    select(secondSwitcher, projectId);
    await waitFor(() => document.querySelector('#workspace-project-switcher')?.value === projectId, 'return to first project');
    check('switch back preserves first native data', (await invoke('load_project_crawl_checkpoint', { projectId })).fixture === 'desktop-e2e-persistence');
    validation = await window.__seomiDesktopValidation.run({ invoke, projectId });
    check('reject-first IPC validation executed', validation.status === 'executed' && validation.passed === true);
    await invoke('delete_project_crawl_checkpoint', { projectId });
    check('native checkpoint deletion verified', await invoke('load_project_crawl_checkpoint', { projectId }) === null);
    renderer = rendererEnabled
      ? await window.__seomiRendererE2e.run({ invoke, projectId })
      : window.__seomiRendererE2e.skipped();
    await report({ passed: renderer.passed === true, checks, validation, renderer, runtime: navigator.userAgent });
  } catch (error) {
    await report({
      passed: false,
      checks,
      failure: String(error),
      validation,
      renderer: renderer || {
        status: rendererEnabled ? 'executed' : 'skipped',
        passed: false,
        checks: [],
        reason: rendererEnabled ? undefined : 'Renderer checks were disabled.',
      },
      runtime: navigator.userAgent,
    });
  }
})();
