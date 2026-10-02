use super::findings::add_finding;
use crate::models::audit_data::AmpFinding;
use scraper::{Html, Selector};

const MAX_COMPONENTS: usize = 64;

pub(super) fn check(document: &Html, findings: &mut Vec<AmpFinding>) {
    let all_elements_selector = Selector::parse("*").unwrap();
    let runtime_selector = Selector::parse("script[src]").unwrap();
    let mut component_names = Vec::new();
    for element in document.select(&all_elements_selector) {
        let tag = element.value().name();
        if tag.starts_with("amp-") && !component_names.iter().any(|name| name == tag) {
            component_names.push(tag.to_string());
            if component_names.len() >= MAX_COMPONENTS {
                break;
            }
        }
    }
    for component in component_names {
        if matches!(component.as_str(), "amp-img" | "amp-layout" | "amp-pixel") {
            continue;
        }
        let loaded = document.select(&runtime_selector).any(|script| {
            script
                .value()
                .attr("src")
                .is_some_and(|src| extension_matches(src, &component))
        });
        if !loaded {
            add_finding(
                findings,
                "amp-component-script-missing",
                "warning",
                format!("The AMP component <{component}> has no recognized extension script."),
                format!("No matching extension script for <{component}>, including versioned extension URLs."),
                "Load the matching AMP component extension before using the element.",
            );
        }
    }
}

pub(super) fn extension_matches(src: &str, component: &str) -> bool {
    let src = src.trim().trim_end_matches('/');
    let prefix = format!("https://cdn.ampproject.org/v0/{component}");
    if src == format!("{prefix}.js") {
        return true;
    }
    src.strip_prefix(&format!("{prefix}-"))
        .and_then(|suffix| suffix.strip_suffix(".js"))
        .is_some_and(|version| {
            let parts: Vec<_> = version.split('.').collect();
            parts.len() >= 2
                && parts
                    .iter()
                    .all(|part| !part.is_empty() && part.bytes().all(|byte| byte.is_ascii_digit()))
        })
}
