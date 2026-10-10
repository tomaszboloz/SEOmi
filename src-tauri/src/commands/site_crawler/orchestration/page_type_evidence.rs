use super::page_type_links::{count_words, mostly_internal_links};
use scraper::{Html, Selector};
use serde_json::Value;
use url::Url;

pub(super) fn is_listing(document: &Html, page_url: &str) -> bool {
    has_pagination_relation(document)
        || paginated_path(page_url)
        || has_collection_schema(document)
        || mostly_internal_links(document, page_url)
}

fn has_pagination_relation(document: &Html) -> bool {
    let selector = Selector::parse("link[rel], a[rel]").expect("valid selector");
    document.select(&selector).any(|element| {
        element.value().attr("rel").is_some_and(|rel| {
            rel.split_ascii_whitespace()
                .any(|part| matches!(part.to_ascii_lowercase().as_str(), "next" | "prev"))
        })
    })
}

fn paginated_path(page_url: &str) -> bool {
    let Ok(url) = Url::parse(page_url) else {
        return false;
    };
    let Some(segments) = url.path_segments() else {
        return false;
    };
    segments.collect::<Vec<_>>().windows(2).any(|pair| {
        pair[0].eq_ignore_ascii_case("page")
            && pair[1].parse::<u32>().is_ok_and(|number| number > 0)
    })
}

fn has_collection_schema(document: &Html) -> bool {
    let selector = Selector::parse("script[type]").expect("valid selector");
    let json_ld = document.select(&selector).any(|script| {
        script.value().attr("type").is_some_and(|kind| {
            kind.eq_ignore_ascii_case("application/ld+json")
                && serde_json::from_str::<Value>(&script.text().collect::<String>())
                    .ok()
                    .is_some_and(|value| contains_collection_type(&value))
        })
    });
    json_ld || has_collection_microdata(document)
}

fn has_collection_microdata(document: &Html) -> bool {
    let selector = Selector::parse("[itemtype], [typeof]").expect("valid selector");
    document.select(&selector).any(|element| {
        [
            element.value().attr("itemtype"),
            element.value().attr("typeof"),
        ]
        .into_iter()
        .flatten()
        .flat_map(str::split_ascii_whitespace)
        .any(is_collection_type)
    })
}

fn contains_collection_type(value: &Value) -> bool {
    match value {
        Value::Array(values) => values.iter().any(contains_collection_type),
        Value::Object(map) => {
            let current = map.get("@type").is_some_and(|types| match types {
                Value::String(kind) => is_collection_type(kind),
                Value::Array(values) => values
                    .iter()
                    .filter_map(Value::as_str)
                    .any(is_collection_type),
                _ => false,
            });
            current || map.values().any(contains_collection_type)
        }
        _ => false,
    }
}

fn is_collection_type(kind: &str) -> bool {
    matches!(
        kind.trim()
            .trim_end_matches('/')
            .rsplit('/')
            .next()
            .unwrap_or_default()
            .to_ascii_lowercase()
            .as_str(),
        "collectionpage" | "blog"
    )
}

pub(super) fn has_application_shell(document: &Html) -> bool {
    let selector = Selector::parse("[id], [data-reactroot], [data-v-app], [ng-version], [ng-app]")
        .expect("valid selector");
    let root = document.select(&selector).any(|element| {
        let marker = element
            .value()
            .attr("id")
            .unwrap_or_default()
            .to_ascii_lowercase();
        let known = ["root", "app", "app-root", "__next", "__nuxt", "svelte"]
            .iter()
            .any(|candidate| marker == *candidate);
        let framework_marker = element.value().attrs().any(|(name, _)| {
            matches!(
                name,
                "data-reactroot" | "data-v-app" | "ng-version" | "ng-app"
            )
        });
        (known || framework_marker) && count_words(element.text()) <= 8
    });
    root && has_script_bundle(document)
}

fn has_script_bundle(document: &Html) -> bool {
    let selector = Selector::parse("script[src]").expect("valid selector");
    document.select(&selector).any(|script| {
        let src = script
            .value()
            .attr("src")
            .unwrap_or_default()
            .to_ascii_lowercase();
        [
            ".js", ".mjs", "/_next/", "/_nuxt/", "/static/", "/assets/", "/build/",
        ]
        .iter()
        .any(|marker| src.contains(marker))
    })
}
