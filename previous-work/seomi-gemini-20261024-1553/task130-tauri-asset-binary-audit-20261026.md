# SEOmi 0.4.41 Windows Settings chunk binary audit (read-only)

Date: 2026-10-26  
Target: `/Volumes/Kingston/seomi-build/release0441-recovery/windows-package/seomi.exe`  
Question: whether the reported `http://tauri.localhost/assets/SettingsModal-CWV7oazO.js` failure is explained by the Settings chunk being absent from the packaged executable.

## Binary identity

- PE32+ x86-64 GUI Windows executable.
- FileVersion/ProductVersion: `0.4.41`.
- Size: `38,262,272` bytes.
- SHA-256: `46a8056c99e140d11a0504e1c0d3843a5504e1be91566b933631e3ec488aa7d6`.
- Sections observed: `.text` `0x00d37910`, `.rdata` `0x01693058`, `.rsrc` `0x0005abe0`.
- 7-Zip inspection shows `.rsrc` contains version/icon resources; frontend assets are embedded/compressed in `.rdata`.

## Settings asset evidence

The literal asset key `/assets/SettingsModal-CWV7oazO.js` occurs at executable offset `17,471,223` (`0x010A96F7`). The bytes from the end of that key to the next asset key are a valid Brotli payload:

- compressed payload size: `14,727` bytes;
- decompressed size: `61,406` bytes;
- decompressed SHA-256: `45387c63232ecbdae3125d515560e76d4698da9d7ad0fa384d1e2b5d663a4a11`.

The decompressed payload begins with valid ESM imports. The following 23 direct dependency keys referenced by this chunk are also present in the executable:

`HelpTip-BEWo_px6.js`, `SecretKeyField-BquJy_7t.js`, `clipboard-dqatf-gR.js`, `data-vendor-TlUyPtIQ.js`, `dataforseo-By4g-k4w.js`, `delivery-WXlsoHxM.js`, `download-D5_t0_KW.js`, `enforce-CGW1TxyO.js`, `ga4Cache-B63fmj9M.js`, `history-BW3AYaQV.js`, `i18n-CZjVthL_.js`, `i18n-vendor-xGfJ3VFQ.js`, `icons-vendor-DcCZopxQ.js`, `index-CxZ0Ue1p.js`, `llmEconomy-BhzqMMV8.js`, `projectStore-CRMbvZqR.js`, `react-vendor-DUTLrdlK.js`, `rolldown-runtime-XKyaHtl9.js`, `tauri-CbqqxqEv.js`, `tauri-vendor-BiFqnGCU.js`, `toolsStore-B6bPD2UA.js`, `useDataForSeoCost--9Xk8vYy.js`, and `useModalA11y-JJpE8PYw.js`.

This rules out “the primary SettingsModal chunk is missing from the executable” as the primary explanation. It does not prove that the installed WebView2 request returned the expected bytes.

## Runtime source cross-check

The pinned Cargo registry sources were inspected read-only:

- `tauri-codegen-2.7.4/src/embedded_assets.rs:68-76,305-390`: frontend assets are Brotli-compressed and embedded.
- `tauri-utils-2.10.1/src/assets.rs:167-181`: embedded asset lookup/decompression returns `None` if the asset is absent or decompression fails.
- `tauri-2.12.5/src/manager/mod.rs:375-420`: leading `/` normalization, exact asset lookup, then HTML fallback.
- `tauri-2.12.5/src/protocol/tauri.rs:145-186`: request-path handling delegates to `manager.get_asset`.
- `wry-0.57.1/src/webview2/mod.rs:1020-1025,1072-1117`: Windows WebView2 workaround intercepts `http://tauri.localhost/*`.
- `wry-0.57.1/src/webview2/mod.rs:1190-1197`: workaround URL is converted back to `tauri://localhost/...` before the Tauri handler.
- `wry-0.57.1/src/custom_protocol_workaround.rs`: defines the `http://tauri.localhost` workaround.

Accordingly, a simple `tauri.localhost` prefix mismatch is unlikely in the pinned runtime. Remaining evidence-backed possibilities are WebView2 request interception/response failure, a failing direct dependency reported through the parent dynamic import, stale WebView2 cache/update state, or a response status/body mismatch (for example HTML fallback, empty response, or 404) despite the asset being present.

## Conclusion and next observation

Binary inspection confirms that the 0.4.41 executable contains a valid SettingsModal asset and all of its direct chunk keys. The audit therefore cannot attribute the reported failure to omission of `SettingsModal-CWV7oazO.js` from this executable. No production/live conclusion follows from this static result.

The minimal next diagnostic is a WebView2 DevTools/network trace of the exact request and any child imports, recording URL, status, content type, byte count, and response prefix. That distinguishes packaged-asset lookup from WebView2 interception/cache/update behavior without changing the frozen source or release artifacts.

No repository files, Git state, installers, credentials, builds, tests, or processes were modified by this audit.
