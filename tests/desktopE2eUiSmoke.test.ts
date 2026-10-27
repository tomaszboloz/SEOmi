import { describe, expect, it } from 'vitest';
import { createDom, createHarness, execute } from './desktopE2eUiFixture';

describe('desktop UI smoke harness', () => {
  it('fails quickly with root boundary and preserves dynamic-import console evidence', async () => {
    const dom = createDom('<main role="alert"><pre>Failed to fetch dynamically imported module: /assets/Settings-abc.js</pre></main>');
    const consoleErrors: string[] = [];
    const { api, console } = execute(dom, consoleErrors);
    console.error('Failed to fetch dynamically imported module: /assets/Settings-abc.js');
    const started = Date.now();
    const result = await api.run();
    expect(Date.now() - started).toBeLessThan(1000);
    expect(result.status).toBe('executed');
    expect(result.passed).toBe(false);
    expect(result.checks).toHaveLength(0);
    expect(result.rootError).toContain('Failed to fetch dynamically imported module');
    expect(result.consoleErrors).toEqual(['Failed to fetch dynamically imported module: /assets/Settings-abc.js']);
  });
  it('passes all lazy dialogs and sidebar routes with exactly 21 checks', async () => {
    const { api } = createHarness();
    const result = await api.run();
    expect(result).toMatchObject({ status: 'executed', passed: true });
    expect(result.checks).toHaveLength(21);
    expect(result.checks).toContain('settings modal lazy dialog rendered');
    expect(result.checks).toContain('create project lazy dialog rendered');
    expect(result.checks).toContain('sidebar lazy route seo-tools rendered');
  });
  it('reports a route boundary by role without depending on translated error text', async () => {
    const { api } = createHarness({ routeErrorTab: 'site-audit' });
    const result = await api.run();
    expect(result.passed).toBe(false);
    expect(result.failure).toContain('ui-runtime-error: Nie udało się wyrenderować tej trasy');
    expect(result.routeError).toBe('Nie udało się wyrenderować tej trasy');
    expect(result.checks).toHaveLength(7);
  });
});
