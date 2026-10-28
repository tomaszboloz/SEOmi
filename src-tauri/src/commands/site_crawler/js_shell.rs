use super::models::{CrawledPageFocus, JsShellReason};
use scraper::{Html, Selector};

/// Below this many words a page with SPA markers is treated as an empty shell.
const SHELL_MAX_WORDS: usize = 50;
/// Markers checked in order; `__NUXT_DATA__` before `__NUXT__` (not a substring).
const PAYLOAD_MARKERS: [(&str, JsShellReason); 5] = [
    ("__NEXT_DATA__", JsShellReason::NextData),
    ("__NUXT_DATA__", JsShellReason::NuxtPayload),
    ("__NUXT__", JsShellReason::NuxtPayload),
    ("__INITIAL_STATE__", JsShellReason::InitialState),
    ("__PRELOADED_STATE__", JsShellReason::InitialState),
];
const BUNDLE_HINTS: [&str; 4] = ["app", "chunk", "main", "bundle"];
const ROOT_IDS: [&str; 5] = ["root", "app", "__next", "__nuxt", "___gatsby"];

/// Detected shell: reason plus, for payload markers, the marker and script text.
pub(super) struct ShellSignal {
    pub reason: JsShellReason,
    pub payload: Option<(&'static str, String)>,
}

/// Classify thin static HTML that carries SPA bundler or hydration-payload signals.
pub(super) fn detect_js_shell(document: &Html, word_count: usize) -> Option<ShellSignal> {
    if word_count >= SHELL_MAX_WORDS {
        return None;
    }
    let scripts = Selector::parse("script").expect("static selector");
    let mut has_bundle = false;
    for script in document.select(&scripts) {
        let element = script.value();
        let id = element.id().unwrap_or_default();
        let inline: String = script.text().collect();
        let hit = PAYLOAD_MARKERS
            .iter()
            .find(|(marker, _)| id == *marker || inline.contains(marker));
        if let Some(&(marker, reason)) = hit {
            let payload = Some((marker, inline));
            return Some(ShellSignal { reason, payload });
        }
        has_bundle |= element.attr("src").is_some_and(is_bundle_src);
    }
    (has_bundle && has_empty_app_root(document)).then_some(ShellSignal {
        reason: JsShellReason::BundleEmptyRoot,
        payload: None,
    })
}

fn is_bundle_src(src: &str) -> bool {
    let file = src.split(['?', '#']).next().unwrap_or("");
    let name = file.rsplit('/').next().unwrap_or("").to_ascii_lowercase();
    name.ends_with(".js") && BUNDLE_HINTS.iter().any(|hint| name.contains(hint))
}

fn has_empty_app_root(document: &Html) -> bool {
    ROOT_IDS.iter().any(|id| {
        let selector = Selector::parse(&format!("[id=\"{id}\"]")).expect("static selector");
        document
            .select(&selector)
            .any(|root| root.text().all(|text| text.trim().is_empty()))
    })
}

impl CrawledPageFocus {
    /// Record SPA-shell flag, reason and payload; `None` words means not HTML.
    pub(super) fn with_js_shell(mut self, document: &Html, words: Option<usize>) -> Self {
        let Some(count) = words else {
            return self;
        };
        let signal = detect_js_shell(document, count);
        self.is_js_shell_suspected = Some(signal.is_some());
        if let Some(signal) = signal {
            self.js_shell_reason = Some(signal.reason);
            self.spa_payload = signal
                .payload
                .and_then(|(marker, script)| super::js_shell_payload::extract(marker, &script));
        }
        self
    }
}

#[cfg(test)]
#[path = "js_shell_tests.rs"]
mod tests;
