# ALL PACKAGES LATEST — Comprehensive Inventory Report v2

- **Generated At:** `2026-10-25T09:53:45.972356+00:00`
- **Roots:**
  - Frontend: `/Users/tomaszboloz/.codex/worktrees/release-next/seomi`
  - MCP Server: `/Users/tomaszboloz/.codex/worktrees/release-next/seomi/mcp-server`
  - Cargo / Tauri: `/Users/tomaszboloz/.codex/worktrees/deps-latest/seomi/src-tauri`

---

## 1. Executive Summary & Distinction: Compatible Latest vs Registry Latest

> [!IMPORTANT]
> **"Compatible Latest nie znaczy Latest"**:
> - **Frontend npm:** 39 z 40 pakietów znajduje się na **bezwzględnym dist-tag `latest`** z npm registry.
> - **Jedynym wyjątkiem jest `typescript`:** zainstalowano `6.0.3` (highest-compatible), podczas gdy dist-tag `latest` to `7.0.2` (opublikowany 2026-07-08T15:55:18Z).
> - **Peer Blocker:** `typescript-eslint@8.72.0` deklaruje w `peerDependencies`: `"typescript": ">=4.8.4 <6.1.0"`. Próba podbicia TypeScript do 7.0.2 we frontendzie łamie kontrakt peerów (wymagałaby `--legacy-peer-deps` lub `--force`, które są zabronione przez bramki CI/CD).
> - **MCP Server:** nie posiada zależności od `typescript-eslint` i z powodzeniem używa `typescript@7.0.2` jako devDependency!

### Statystyki pakietów:
- **Frontend:** 40 jawnych pakietów | 39 na `latest` | 1 locked-compatible (`typescript@6.0.3`)
- **MCP Server:** 4 jawne pakiety | 4 na `latest` (w tym `typescript@7.0.2`)
- **Cargo (read-only):** 48 jawnych skrzyń | 48 na najnowszym stabilnym crates.io

---

## 2. Frontend Dependencies (`release-next/seomi/package.json`)

| Pakiet | Sekcja | Zadeklarowana | Zainstalowana | Compatible Latest | Registry Latest | Opublikowano (latest) | Status | Uwagi / Peer Blocker |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `@tailwindcss/vite` | dependencies | `^4.3.3` | `4.3.3` | `4.3.3` | `4.3.3` | 2026-07-16T12:04:06.316Z | **latest** | OK |
| `@tauri-apps/api` | dependencies | `^2.12.4` | `2.12.4` | `2.12.4` | `2.12.4` | 2026-10-14T18:47:44.921Z | **latest** | OK |
| `@tauri-apps/plugin-dialog` | dependencies | `^2.8.3` | `2.8.3` | `2.8.3` | `2.8.3` | 2026-10-14T19:17:55.842Z | **latest** | OK |
| `@tauri-apps/plugin-notification` | dependencies | `^2.7.0` | `2.7.0` | `2.7.0` | `2.7.0` | 2026-10-14T19:21:31.419Z | **latest** | OK |
| `@tauri-apps/plugin-process` | dependencies | `^2.4.0` | `2.4.0` | `2.4.0` | `2.4.0` | 2026-09-26T22:58:57.145Z | **latest** | OK |
| `@tauri-apps/plugin-updater` | dependencies | `^2.14.0` | `2.14.0` | `2.14.0` | `2.14.0` | 2026-10-14T19:20:06.017Z | **latest** | OK |
| `clsx` | dependencies | `^2.1.1` | `2.1.1` | `2.1.1` | `2.1.1` | 2024-04-23T05:26:04.645Z | **latest** | OK |
| `cytoscape` | dependencies | `^3.34.4` | `3.34.4` | `3.34.4` | `3.34.4` | 2026-10-15T19:14:50.649Z | **latest** | OK |
| `cytoscape-dagre` | dependencies | `^4.0.1` | `4.0.1` | `4.0.1` | `4.0.1` | 2026-08-28T12:23:25.690Z | **latest** | OK |
| `cytoscape-fcose` | dependencies | `^2.2.0` | `2.2.0` | `2.2.0` | `2.2.0` | 2023-01-17T13:53:14.042Z | **latest** | OK |
| `date-fns` | dependencies | `^4.4.0` | `4.4.0` | `4.4.0` | `4.4.0` | 2026-05-29T23:23:42.628Z | **latest** | OK |
| `i18next` | dependencies | `^26.5.10` | `26.5.10` | `26.5.10` | `26.5.10` | 2026-10-24T10:15:27.100Z | **latest** | OK |
| `lucide-react` | dependencies | `^1.61.0` | `1.61.0` | `1.61.0` | `1.61.0` | 2026-10-21T06:12:38.158Z | **latest** | OK |
| `react` | dependencies | `^19.3.1` | `19.3.1` | `19.3.1` | `19.3.1` | 2026-10-14T16:47:15.290Z | **latest** | OK |
| `react-dom` | dependencies | `^19.3.1` | `19.3.1` | `19.3.1` | `19.3.1` | 2026-10-14T16:49:10.081Z | **latest** | OK |
| `react-i18next` | dependencies | `^17.1.8` | `17.1.8` | `17.1.8` | `17.1.8` | 2026-10-24T12:39:38.510Z | **latest** | OK |
| `tailwindcss` | dependencies | `^4.3.3` | `4.3.3` | `4.3.3` | `4.3.3` | 2026-07-16T12:03:35.267Z | **latest** | OK |
| `tldts` | dependencies | `^7.4.19` | `7.4.19` | `7.4.19` | `7.4.19` | 2026-10-20T13:41:17.571Z | **latest** | OK |
| `zod` | dependencies | `^4.6.7` | `4.6.7` | `4.6.7` | `4.6.7` | 2026-10-12T16:29:37.778Z | **latest** | OK |
| `zustand` | dependencies | `^5.0.16` | `5.0.16` | `5.0.16` | `5.0.16` | 2026-10-22T04:32:02.337Z | **latest** | OK |
| `@bcoe/v8-coverage` | devDependencies | `1.0.2` | `1.0.2` | `1.0.2` | `1.0.2` | 2025-01-15T17:30:44.306Z | **latest** | OK |
| `@eslint/js` | devDependencies | `10.0.1` | `10.0.1` | `10.0.1` | `10.0.1` | 2026-02-06T22:34:56.290Z | **latest** | OK |
| `@tauri-apps/cli` | devDependencies | `^2.12.4` | `2.12.4` | `2.12.4` | `2.12.4` | 2026-10-21T12:20:52.691Z | **latest** | OK |
| `@testing-library/react` | devDependencies | `^16.3.3` | `16.3.3` | `16.3.3` | `16.3.3` | 2026-08-27T17:41:18.735Z | **latest** | OK |
| `@types/cytoscape-dagre` | devDependencies | `^2.3.4` | `2.3.4` | `2.3.4` | `2.3.4` | 2025-10-10T07:33:27.252Z | **latest** | OK |
| `@types/cytoscape-fcose` | devDependencies | `^2.2.5` | `2.2.5` | `2.2.5` | `2.2.5` | 2025-10-10T07:33:46.088Z | **latest** | OK |
| `@types/node` | devDependencies | `^26.6.5` | `26.6.5` | `26.6.5` | `26.6.5` | 2026-10-09T18:46:47.657Z | **latest** | OK |
| `@types/react` | devDependencies | `^19.3.0` | `19.3.0` | `19.3.0` | `19.3.0` | 2026-09-09T18:08:49.750Z | **latest** | OK |
| `@types/react-dom` | devDependencies | `^19.3.0` | `19.3.0` | `19.3.0` | `19.3.0` | 2026-09-09T18:07:51.886Z | **latest** | OK |
| `@vitejs/plugin-react` | devDependencies | `^6.1.2` | `6.1.2` | `6.1.2` | `6.1.2` | 2026-10-05T10:08:27.143Z | **latest** | OK |
| `@vitest/coverage-v8` | devDependencies | `^5.0.5` | `5.0.5` | `5.0.5` | `5.0.5` | 2026-10-15T14:27:49.006Z | **latest** | OK |
| `ast-v8-to-istanbul` | devDependencies | `1.0.7` | `1.0.7` | `1.0.7` | `1.0.7` | 2026-09-21T14:30:05.425Z | **latest** | OK |
| `eslint` | devDependencies | `10.13.0` | `10.13.0` | `10.13.0` | `10.13.0` | 2026-10-16T14:24:10.765Z | **latest** | OK |
| `eslint-plugin-react-hooks` | devDependencies | `7.1.1` | `7.1.1` | `7.1.1` | `7.1.1` | 2026-04-17T18:03:19.591Z | **latest** | OK |
| `globals` | devDependencies | `17.13.0` | `17.13.0` | `17.13.0` | `17.13.0` | 2026-10-01T03:57:11.938Z | **latest** | OK |
| `jsdom` | devDependencies | `^30.1.3` | `30.1.3` | `30.1.3` | `30.1.3` | 2026-10-15T09:24:38.912Z | **latest** | OK |
| `typescript` | devDependencies | `^6.0.3` | `6.0.3` | `6.0.3` | `7.0.2` | 2026-07-08T15:55:18.431Z | **highest-compatible-locked** | typescript-eslint@8.72.0 requires peer typescript: '>=4.8.4 <6.1.0'. Upgrading to typescript@7.0.2 breaks eslint peer dependencies. |
| `typescript-eslint` | devDependencies | `8.72.0` | `8.72.0` | `8.72.0` | `8.72.0` | 2026-10-19T17:08:09.147Z | **latest** | OK |
| `vite` | devDependencies | `^8.3.5` | `8.3.5` | `8.3.5` | `8.3.5` | 2026-10-21T06:38:54.907Z | **latest** | OK |
| `vitest` | devDependencies | `^5.0.5` | `5.0.5` | `5.0.5` | `5.0.5` | 2026-10-15T14:29:01.396Z | **latest** | OK |

---

## 3. MCP Server Dependencies (`mcp-server/package.json`)

| Pakiet | Sekcja | Zadeklarowana | Zainstalowana | Registry Latest | Opublikowano (latest) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `@modelcontextprotocol/sdk` | dependencies | `1.32.2` | `1.32.2` | `1.32.2` | 2026-10-23T18:11:38.362Z | **latest** |
| `zod` | dependencies | `4.6.7` | `4.6.7` | `4.6.7` | 2026-10-12T16:29:37.778Z | **latest** |
| `@types/node` | devDependencies | `26.6.5` | `26.6.5` | `26.6.5` | 2026-10-09T18:46:47.657Z | **latest** |
| `typescript` | devDependencies | `7.0.2` | `7.0.2` | `7.0.2` | 2026-07-08T15:55:18.431Z | **latest** |

---

## 4. Cargo / Rust Dependencies (`src-tauri/Cargo.toml` — Read Only deps-latest; ROOT nie zintegrowany)

| Crate | Sekcja | Zadeklarowana | Zainstalowana (Cargo.lock) | Crates.io Latest | Opublikowano | Status | Rekomendowana Minimalna Migracja |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `tauri` | dev-dependencies | `2.12.5` | `2.12.5` | `2.12.5` | 2026-10-21T11:54:45.622972Z | **latest** | Aktualna |
| `tauri-plugin-dialog` | dependencies | `2.8.3` | `2.8.3` | `2.8.3` | 2026-10-14T21:47:48.140922Z | **latest** | Aktualna |
| `tauri-plugin-updater` | dependencies | `2.14.0` | `2.14.0` | `2.14.0` | 2026-10-14T21:51:57.585615Z | **latest** | Aktualna |
| `tauri-plugin-process` | dependencies | `2.4.0` | `2.4.0` | `2.4.0` | 2026-10-14T21:50:54.436838Z | **latest** | Aktualna |
| `tauri-plugin-notification` | dependencies | `2.7.0` | `2.7.0` | `2.7.0` | 2026-10-14T21:49:52.518356Z | **latest** | Aktualna |
| `serde` | dependencies | `1.0.229` | `1.0.229` | `1.0.229` | 2026-07-18T23:05:13.266456Z | **latest** | Aktualna |
| `serde_json` | dependencies | `1.0.154` | `1.0.154` | `1.0.154` | 2026-10-11T15:31:46.076577Z | **latest** | Aktualna |
| `unicode-normalization` | dependencies | `0.1.26` | `0.1.26` | `0.1.26` | 2026-10-16T23:28:29.955206Z | **latest** | Aktualna |
| `ttf-parser` | dependencies | `0.25.1` | `0.25.1` | `0.25.1` | 2024-11-29T19:59:37.395141Z | **latest** | Aktualna |
| `rustybuzz` | dependencies | `0.20.1` | `0.20.1` | `0.20.1` | 2024-11-12T11:53:33.625252Z | **latest** | Aktualna |
| `unicode-bidi` | dependencies | `0.3.18` | `0.3.18` | `0.3.18` | 2024-12-16T23:09:47.459625Z | **latest** | Aktualna |
| `flate2` | dependencies | `1.1.10` | `1.1.10` | `1.1.10` | 2026-08-28T04:35:22.192325Z | **latest** | Aktualna |
| `tokio` | dev-dependencies | `1.54.1` | `1.54.1` | `1.54.1` | 2026-10-21T21:05:43.950213Z | **latest** | Aktualna |
| `reqwest` | dependencies | `0.13.5` | `0.13.5` | `0.13.5` | 2026-09-08T20:55:26.479356Z | **latest** | Aktualna |
| `scraper` | dependencies | `0.29.0` | `0.29.0` | `0.29.0` | 2026-10-21T08:08:33.055075Z | **latest** | Aktualna |
| `url` | dependencies | `2.5.8` | `2.5.8` | `2.5.8` | 2026-01-05T22:14:31.414927Z | **latest** | Aktualna |
| `regex` | dependencies | `1.13.1` | `1.13.1` | `1.13.1` | 2026-07-15T20:19:35.162139Z | **latest** | Aktualna |
| `chrono` | dependencies | `0.4.45` | `0.4.45` | `0.4.45` | 2026-06-04T12:16:42.063037Z | **latest** | Aktualna |
| `anyhow` | dependencies | `1.0.104` | `1.0.104` | `1.0.104` | 2026-07-18T20:59:37.656167Z | **latest** | Aktualna |
| `thiserror` | dependencies | `2.0.21` | `2.0.21` | `2.0.21` | 2026-09-23T20:24:07.771104Z | **latest** | Aktualna |
| `base64` | dependencies | `0.23.1` | `0.23.1` | `0.23.1` | 2026-08-04T12:34:31.976297Z | **latest** | Aktualna |
| `sha2` | dependencies | `0.11.1` | `0.11.1` | `0.11.1` | 2026-10-12T18:58:22.836567Z | **latest** | Aktualna |
| `uuid` | dependencies | `1.29.0` | `1.29.0` | `1.29.0` | 2026-10-23T09:59:10.723650Z | **latest** | Aktualna |
| `log` | dependencies | `0.4.34` | `0.4.34` | `0.4.34` | 2026-08-22T11:44:27.941626Z | **latest** | Aktualna |
| `env_logger` | dependencies | `0.11.11` | `0.11.11` | `0.11.11` | 2026-06-25T12:42:02.332351Z | **latest** | Aktualna |
| `tracing` | dependencies | `0.1.44` | `0.1.44` | `0.1.44` | 2025-12-18T14:26:12.360139Z | **latest** | Aktualna |
| `tracing-subscriber` | dependencies | `0.3.23` | `0.3.23` | `0.3.23` | 2026-03-13T10:04:15.571048Z | **latest** | Aktualna |
| `mime` | dependencies | `0.3.17` | `0.3.17` | `0.3.17` | 2023-03-20T15:05:04.272177Z | **latest** | Aktualna |
| `encoding_rs` | dependencies | `0.8.42` | `0.8.42` | `0.8.42` | 2026-09-24T14:45:32.296812Z | **latest** | Aktualna |
| `keyring` | dependencies | `4.2.0` | `4.2.0` | `4.2.0` | 2026-08-29T23:48:56.175457Z | **latest** | Aktualna |
| `fs2` | dependencies | `0.4.3` | `0.4.3` | `0.4.3` | 2018-01-06T20:18:30.565584Z | **latest** | Aktualna |
| `dunce` | dependencies | `1.0.5` | `1.0.5` | `1.0.5` | 2024-08-04T01:36:46.487482Z | **latest** | Aktualna |
| `rusqlite` | dependencies | `0.41.0` | `0.41.0` | `0.41.0` | 2026-10-24T10:35:41.505736Z | **latest** | Aktualna |
| `chacha20poly1305` | dependencies | `0.11.0` | `0.11.0` | `0.11.0` | 2026-08-05T13:00:37.663365Z | **latest** | Aktualna |
| `getrandom` | dependencies | `0.4.3` | `0.4.3` | `0.4.3` | 2026-06-17T18:01:59.979552Z | **latest** | Aktualna |
| `dns-lookup` | dependencies | `4.0.2` | `4.0.2` | `4.0.2` | 2026-10-01T09:34:55.262766Z | **latest** | Aktualna |
| `syn` | dev-dependencies | `3.0.9` | `3.0.9` | `3.0.9` | 2026-10-12T15:04:09.212573Z | **latest** | Aktualna |
| `proc-macro2` | dev-dependencies | `1.0.107` | `1.0.107` | `1.0.107` | 2026-07-19T00:18:25.189787Z | **latest** | Aktualna |
| `minisign-verify` | dev-dependencies | `0.3.0` | `0.3.0` | `0.3.0` | 2026-09-25T08:40:55.288773Z | **latest** | Aktualna |
| `tauri-build` | build-dependencies | `2.7.4` | `2.7.4` | `2.7.4` | 2026-10-21T11:53:41.144795Z | **latest** | Aktualna |
| `windows-sys` | target.cfg(windows) | `0.61.2` | `0.61.2` | `0.61.2` | 2025-10-06T19:18:30.163595Z | **latest** | Aktualna |
| `webview2-com` | target.cfg(windows) | `0.39.1` | `0.39.1` | `0.39.1` | 2026-03-11T06:54:35.239990Z | **latest** | Aktualna |
| `windows` | target.cfg(windows) | `0.62.2` | `0.62.2` | `0.62.2` | 2025-10-06T19:19:49.704461Z | **latest** | Aktualna |
| `block2` | target.cfg(target_os = "macos") | `0.6.2` | `0.6.2` | `0.6.2` | 2025-10-04T16:00:20.987008Z | **latest** | Aktualna |
| `objc2` | target.cfg(target_os = "macos") | `0.6.5` | `0.6.5` | `0.6.5` | 2026-10-05T18:26:53.790244Z | **latest** | Aktualna |
| `objc2-app-kit` | target.cfg(target_os = "macos") | `0.3.2` | `0.3.2` | `0.3.2` | 2025-10-04T16:16:50.311115Z | **latest** | Aktualna |
| `objc2-foundation` | target.cfg(target_os = "macos") | `0.3.2` | `0.3.2` | `0.3.2` | 2025-10-04T15:47:21.149969Z | **latest** | Aktualna |
| `objc2-web-kit` | target.cfg(target_os = "macos") | `0.3.2` | `0.3.2` | `0.3.2` | 2025-10-04T16:35:45.318523Z | **latest** | Aktualna |

