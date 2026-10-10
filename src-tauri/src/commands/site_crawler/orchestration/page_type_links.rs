use scraper::{ElementRef, Html, Selector};
use std::collections::HashSet;
use url::Url;

pub(super) fn mostly_internal_links(document: &Html, page_url: &str) -> bool {
    let Ok(base) = Url::parse(page_url) else {
        return false;
    };
    let root_selector = Selector::parse("main, article, [role='main']").expect("root selector");
    let has_root = document.select(&root_selector).next().is_some();
    let anchor_selector = if has_root {
        Selector::parse("main a[href], article a[href], [role='main'] a[href]")
            .expect("root link selector")
    } else {
        Selector::parse("body a[href]").expect("body link selector")
    };
    let body_words = if has_root {
        document
            .select(&root_selector)
            .map(|root| count_words(root.text()))
            .sum()
    } else {
        document
            .select(&Selector::parse("body").expect("body selector"))
            .next()
            .map(|body| count_words(body.text()))
            .unwrap_or_default()
    };
    let mut targets = HashSet::new();
    let mut total = 0;
    let mut internal = 0;
    let mut anchor_words = 0;
    for anchor in document.select(&anchor_selector) {
        if has_chrome_ancestor(&anchor) {
            continue;
        }
        let href = anchor.value().attr("href").unwrap_or_default().trim();
        if href.is_empty() {
            continue;
        }
        let Some(target) = base.join(href).ok() else {
            continue;
        };
        if !matches!(target.scheme(), "http" | "https") || target.fragment().is_some() {
            continue;
        }
        if !targets.insert(target.as_str().to_owned()) {
            continue;
        }
        total += 1;
        if target.host() == base.host() && page_like_path(target.path()) {
            internal += 1;
            anchor_words += count_words(anchor.text());
        }
    }
    internal >= 4
        && internal * 100 >= total * 70
        && body_words > 0
        && anchor_words * 100 >= body_words * 45
}

fn has_chrome_ancestor(element: &ElementRef<'_>) -> bool {
    element
        .ancestors()
        .filter_map(ElementRef::wrap)
        .any(|ancestor| {
            matches!(
                ancestor.value().name(),
                "header" | "nav" | "footer" | "aside" | "form"
            ) || ancestor.value().attr("aria-label").is_some_and(|label| {
                ["navigation", "menu", "breadcrumb"]
                    .iter()
                    .any(|marker| label.to_ascii_lowercase().contains(marker))
            })
        })
}

fn page_like_path(path: &str) -> bool {
    let last = path
        .rsplit('/')
        .find(|part| !part.is_empty())
        .unwrap_or_default();
    let last = last.to_ascii_lowercase();
    let Some(extension) = last.rsplit_once('.').map(|(_, extension)| extension) else {
        return true;
    };
    ["html", "htm", "php"].contains(&extension)
}

pub(super) fn count_words<'a>(parts: impl Iterator<Item = &'a str>) -> usize {
    parts
        .flat_map(str::split_whitespace)
        .filter(|part| part.chars().any(char::is_alphanumeric))
        .count()
}
