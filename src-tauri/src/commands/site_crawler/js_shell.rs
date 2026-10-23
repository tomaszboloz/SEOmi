use super::models::CrawledPageFocus;
use scraper::{Html, Selector};

/// Below this many words a page with SPA markers is treated as an empty shell.
const SHELL_MAX_WORDS: usize = 50;
const PAYLOAD_MARKERS: [&str; 3] = ["__NEXT_DATA__", "__NUXT__", "__NUXT_DATA__"];
const BUNDLE_HINTS: [&str; 4] = ["app", "chunk", "main", "bundle"];
const ROOT_IDS: [&str; 5] = ["root", "app", "__next", "__nuxt", "___gatsby"];

/// True when thin static HTML carries SPA bundler or hydration-payload signals.
pub(super) fn looks_like_js_shell(document: &Html, word_count: usize) -> bool {
    if word_count >= SHELL_MAX_WORDS {
        return false;
    }
    let scripts = Selector::parse("script").expect("static selector");
    let mut has_bundle = false;
    for script in document.select(&scripts) {
        let element = script.value();
        let id = element.id().unwrap_or_default();
        let inline: String = script.text().collect();
        if PAYLOAD_MARKERS
            .iter()
            .any(|marker| id == *marker || inline.contains(marker))
        {
            return true;
        }
        has_bundle |= element.attr("src").is_some_and(is_bundle_src);
    }
    has_bundle && has_app_root(document)
}

fn is_bundle_src(src: &str) -> bool {
    let file = src.split(['?', '#']).next().unwrap_or("");
    let name = file.rsplit('/').next().unwrap_or("").to_ascii_lowercase();
    name.ends_with(".js") && BUNDLE_HINTS.iter().any(|hint| name.contains(hint))
}

fn has_app_root(document: &Html) -> bool {
    ROOT_IDS.iter().any(|id| {
        let selector = Selector::parse(&format!("[id=\"{id}\"]")).expect("static selector");
        document.select(&selector).next().is_some()
    })
}

impl CrawledPageFocus {
    /// Record the SPA-shell flag; `None` words means the page is not HTML.
    pub(super) fn with_js_shell(mut self, document: &Html, words: Option<usize>) -> Self {
        self.is_js_shell_suspected = words.map(|count| looks_like_js_shell(document, count));
        self
    }
}

#[cfg(test)]
#[path = "js_shell_tests.rs"]
mod tests;
