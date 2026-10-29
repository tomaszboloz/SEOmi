# SEOmi 0.4.41 Windows dynamic-asset audit (read-only)

Date: 2026-10-26
Scope: `Failed to fetch dynamically imported module: http://tauri.localhost/assets/SettingsModal-CWV7oaz.js`

## Evidence

- `vite.config.ts:23-27` sets `base: './'` and explicitly documents that Tauri needs relative asset URLs. The observed `http://tauri.localhost/assets/...` URL is therefore consistent with a relative Vite dynamic import resolved by the Windows Tauri origin; it is not, by itself, proof of a wrong `base`.
- `src-tauri/tauri.conf.json:6-10` runs `npm run build` before Tauri build and embeds `../dist` as `frontendDist`. `src-tauri/tauri.conf.json:28-30` permits same-origin scripts with `script-src 'self'`; no obvious CSP rule blocks a same-origin module.
- `src-tauri/src/lib.rs:31-35` shows the production builder only installs the standard Tauri plugins. No project Rust code registers a custom URI scheme or asset protocol handler. Asset serving is consequently the standard Tauri frontend asset path, not a project-owned handler.
- `src/App.tsx:18-23` creates `SettingsModal` (and the other top-level modals) with bare `React.lazy(() => import(...))`. `src/App.tsx:71-74` renders Settings inside Suspense, but Suspense does not recover a rejected import promise.
- `src/services/lazyRoute.ts:9-29` has a bounded one-retry loader, but `src/App.tsx` does not use it for SettingsModal. A transient/stale/missing asset request therefore rejects directly into the root boundary.
- `src/main.tsx:16-20` wraps the whole App in `RootErrorBoundary`; `src/components/Layout/RootErrorBoundary.tsx:21-30` converts any rejected lazy import reaching render into the app-level error screen. This explains why one Settings chunk failure can look like “nearly nothing works”; it does not repair the missing asset.
- `.github/workflows/test.yml:220-245` builds frontend, runs tests, compiles Tauri with `--debug --no-bundle`, then launches desktop E2E on macOS and Windows. `src-tauri/examples/desktop_e2e.rs:35-42` injects the E2E scripts; `src-tauri/examples/desktop_e2e.js:61-109` exercises project creation/reload, IPC validation and renderer commands. It never opens Settings, the command palette, or any top-level lazy modal. `desktop_e2e_renderer.js:90-109` tests external-page rendering/artifacts, not local `tauri.localhost/assets/*` chunks.
- `tests/appModalRouting.test.tsx` mocks every modal import, so it validates routing state but not production chunk fetching. `tests/lazyRoute.test.ts` validates retry helper behavior only; it does not cover `SettingsModal`'s bare import.

## Narrow diagnosis

Confirmed from source: the reported failure is a rejected top-level lazy import with no retry, and the existing Windows desktop E2E does not exercise that import. The underlying asset-serving failure is not distinguishable from this checkout alone between (a) a missing chunk in the installed bundle, (b) stale/mismatched index/chunk cache after update, and (c) a transient WebView2 fetch failure. The URL shape and current `base: './'` make an absolute-path Vite regression less likely, but installer contents and a WebView network trace are required before selecting one cause.

## Minimal real reproduction / test strategy

1. Build the exact release commit on Windows with `npm ci` and `npm run build`; record `dist/index.html` and every `dist/assets/SettingsModal-*.js` path.
2. Run the exact Tauri packaging command used by release, then inspect the installed application resources. Assert the Settings chunk named by the installed index exists at the packaged frontend asset root and can be fetched as `http://tauri.localhost/assets/<name>`.
3. Launch the installed app in a clean WebView2 profile, create/select a project, open Settings through the header or command palette, and capture DevTools/network status for the exact chunk request (404/connection/CSP/cache).
4. Repeat once after an in-place update from 0.4.40 to 0.4.41 and once with a clean install. A clean-install pass plus update-only failure isolates stale WebView cache or partial update state; a clean-install 404 isolates packaging/asset inclusion.
5. Add a real desktop smoke assertion that opens Settings and waits for a Settings DOM marker; do not treat the current external renderer/IPC E2E as coverage for lazy local chunks.

No code, Git state, credentials, installer files or processes were modified by this audit.

## Operational history note

The v6 full Vitest replacement run completed successfully (1378 files / 11394 tests). An earlier duplicate full-run attempt was interrupted while competing for the shared validation lock; this note records that attempt separately and does not change the frozen v6 artifacts. The root release validator's process ownership was not re-assumed after that event.
