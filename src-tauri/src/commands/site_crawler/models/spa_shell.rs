use serde::{Deserialize, Serialize};

/// Why thin static HTML was classified as an unrendered SPA shell.
#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum JsShellReason {
    /// Next.js `__NEXT_DATA__` hydration payload.
    NextData,
    /// Nuxt `__NUXT__` / `__NUXT_DATA__` hydration payload.
    NuxtPayload,
    /// `window.__INITIAL_STATE__` / `__PRELOADED_STATE__` store snapshot.
    InitialState,
    /// App/chunk/main bundle script plus an empty `#root`/`#app`-style mount.
    BundleEmptyRoot,
}

/// Content read verbatim from an embedded SPA JSON payload. It was never
/// rendered or seen in visible HTML, so it is kept apart from `word_count`.
#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq)]
pub struct SpaPayload {
    /// Always `"payload"`: data came from embedded JSON, not a rendered DOM.
    pub provenance: String,
    /// Marker the payload was read from, e.g. `__NEXT_DATA__`.
    pub source: String,
    /// Shallowest `title`-like string in the payload; absent when none.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    /// Prose strings found in the payload, joined by newlines and bounded.
    #[serde(default)]
    pub text: String,
    /// Words across all prose strings found (bounded by the walk limit).
    #[serde(default)]
    pub word_count: u32,
    /// Raw link values under `href`/`url`/`link`/`path` keys, as found.
    #[serde(default)]
    pub links: Vec<String>,
    /// True when text, links or the JSON walk hit a bound.
    #[serde(default)]
    pub truncated: bool,
}
