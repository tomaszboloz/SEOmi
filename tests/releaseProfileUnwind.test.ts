import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Run 40987852299 (macOS Intel, production-profile desktop E2E) aborted with
// "panic in a function that cannot unwind" right at location.reload(), which
// cancels in-flight protocol tasks: under panic=abort objc2 cannot catch the
// WebKit exception. Guard the fix from 40a347ee against regressions (#90).
const text = (path: string) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const profile = (name: string) =>
  text('src-tauri/Cargo.toml').split(`\n[profile.${name}]\n`)[1]?.split(/\n\[/)[0] ?? '';

describe('desktop release profile unwinding (#90)', () => {
  it('keeps panic = "unwind" in the release profile', () => {
    const release = profile('release');
    expect(release).not.toBe('');
    expect(release).toMatch(/^panic = "unwind"$/m);
    expect(release).not.toMatch(/^panic = "abort"$/m);
  });

  it('runs the Foundation exception probe before every desktop E2E context on macOS', () => {
    const assets = text('src-tauri/examples/desktop_e2e_assets.rs');
    expect(assets).toContain('#[path = "desktop_e2e_exceptions.rs"]');
    const context = assets.split('pub fn verified_context()')[1] ?? '';
    const probe = context.indexOf('exceptions::assert_catchable_navigation_exception();');
    expect(probe).toBeGreaterThan(-1);
    expect(probe).toBeLessThan(context.indexOf('tauri::generate_context!()'));
  });

  it('the probe really throws and catches an Objective-C exception', () => {
    const probe = text('src-tauri/examples/desktop_e2e_exceptions.rs');
    expect(probe).toContain('catch(AssertUnwindSafe(|| throw(exception)))');
    expect(probe).toContain('.expect_err(');
  });

  it('the desktop E2E still reloads the WebView, the path that triggered the abort', () => {
    expect(text('src-tauri/examples/desktop_e2e.js')).toContain('location.reload();');
  });
});
