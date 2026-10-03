use crate::models::audit_data::AmpFinding;
use scraper::{Html, Selector};
use super::models::{add_finding, AMP_CUSTOM_CSS_LIMIT_BYTES, MAX_COMPONENTS};

pub(super) fn check_custom_css(document: &Html, findings: &mut Vec<AmpFinding>) {
    let custom_css_selector = Selector::parse("style[amp-custom]").expect("static selector valid");
    let custom_css_styles = document.select(&custom_css_selector).collect::<Vec<_>>();
    if custom_css_styles.len() > 1 {
        add_finding(
            findings, "amp-custom-css-multiple", "error",
            "The AMP document declares more than one amp-custom style block.".into(),
            format!("Found {} style[amp-custom] declarations.", custom_css_styles.len()),
            "Combine custom CSS into one style[amp-custom] block.",
        );
    }
    let custom_css_bytes = custom_css_styles.iter().map(|s| s.text().collect::<String>().len()).sum::<usize>();
    if custom_css_bytes > AMP_CUSTOM_CSS_LIMIT_BYTES {
        add_finding(
            findings, "amp-custom-css-over-budget", "error",
            "The combined amp-custom CSS exceeds the common 75 KB limit.".into(),
            format!("Measured {custom_css_bytes} UTF-8 bytes; limit {AMP_CUSTOM_CSS_LIMIT_BYTES} bytes."),
            "Reduce amp-custom CSS and confirm the exact limit with the official AMP validator version used by deployment.",
        );
    }
    if custom_css_styles.iter().any(|s| s.text().collect::<String>().to_ascii_lowercase().contains("@import")) {
        add_finding(
            findings, "amp-custom-css-import", "error",
            "The amp-custom CSS contains an @import rule.".into(),
            "style[amp-custom] contains @import".into(),
            "Inline the imported rules in the bounded amp-custom stylesheet.",
        );
    }
}

pub(super) fn check_forbidden_elements_and_handlers(document: &Html, findings: &mut Vec<AmpFinding>) {
    let forbidden_selector = Selector::parse("img,iframe,frame,frameset,object,embed,video,audio").expect("static selector valid");
    let inline_handler_selector = Selector::parse("*[onload],*[onclick],*[onerror],*[onchange],*[onsubmit],*[oninput],*[onfocus],*[onblur],*[onmouseover],*[onkeydown],*[onkeyup],*[onkeypress]").expect("static selector valid");

    for element in document.select(&forbidden_selector).take(MAX_COMPONENTS + 1) {
        let tag = element.value().name().to_ascii_lowercase();
        add_finding(
            findings, "amp-element-not-allowed", "error",
            format!("The AMP document uses the HTML element <{tag}>, which requires an AMP component replacement."),
            format!("<{tag}>"),
            match tag.as_str() {
                "img" => "Use <amp-img> with its required layout and dimensions.",
                "iframe" => "Use <amp-iframe> and load its extension script.",
                "video" => "Use <amp-video> with the AMP video component.",
                "audio" => "Use <amp-audio> with the AMP audio component.",
                _ => "Replace the element with an AMP-supported component.",
            },
        );
    }
    if document.select(&forbidden_selector).count() > MAX_COMPONENTS {
        add_finding(
            findings, "amp-component-limit", "info",
            "AMP element validation reached its safety limit.".into(),
            format!("At most {MAX_COMPONENTS} forbidden element instances are retained."),
            "Review additional elements manually with the official AMP validator.",
        );
    }

    for element in document.select(&inline_handler_selector).take(MAX_COMPONENTS + 1) {
        let tag = element.value().name();
        let handler = element.value().attrs()
            .find(|(name, _)| name.to_ascii_lowercase().starts_with("on"))
            .map(|(name, _)| name).unwrap_or("on*");
        add_finding(
            findings, "amp-inline-event-handler", "error",
            "The AMP document contains an inline event-handler attribute.".into(),
            format!("<{tag} {handler}=…>"),
            "Move interaction to an AMP action/event declaration or an allowed AMP component.",
        );
    }
}

pub(super) fn check_amp_components_and_scripts(document: &Html, findings: &mut Vec<AmpFinding>) {
    let all_elements_selector = Selector::parse("*").expect("static selector valid");
    let runtime_selector = Selector::parse("script[src]").expect("static selector valid");
    let script_selector = Selector::parse("script").expect("static selector valid");

    let mut component_names = Vec::new();
    for element in document.select(&all_elements_selector) {
        let tag = element.value().name();
        if tag.starts_with("amp-") && !component_names.iter().any(|name| name == tag) {
            component_names.push(tag.to_string());
            if component_names.len() >= MAX_COMPONENTS { break; }
        }
    }
    for component in component_names {
        let extension_src = format!("https://cdn.ampproject.org/v0/{component}.js");
        let loaded = document.select(&runtime_selector).any(|script| {
            script.value().attr("src").is_some_and(|src| src.trim().trim_end_matches('/') == extension_src)
        });
        if !loaded {
            add_finding(
                findings, "amp-component-script-missing", "warning",
                format!("The AMP component <{component}> has no recognized extension script."),
                format!("Expected script[src={extension_src}]"),
                "Load the matching AMP component extension before using the element.",
            );
        }
    }

    for script in document.select(&script_selector) {
        let value = script.value();
        let src = value.attr("src").map(str::trim).unwrap_or_default();
        let script_type = value.attr("type").map(str::trim).unwrap_or_default().to_ascii_lowercase();
        let extension_script = src.starts_with("https://cdn.ampproject.org/v0/amp-") && src.ends_with(".js");
        let runtime_script = src.trim_end_matches('/') == "https://cdn.ampproject.org/v0.js";
        let data_script = matches!(script_type.as_str(), "application/ld+json" | "application/json");
        if !runtime_script && !extension_script && !data_script {
            add_finding(
                findings, "amp-script-not-allowlisted", "warning",
                "A script element was found outside the locally recognized AMP runtime/component or data-script patterns.".into(),
                if src.is_empty() { format!("inline script type={script_type:?}") } else { format!("script src={src}") },
                "Verify this script against the official AMP validator; ordinary custom JavaScript is not allowed in AMP HTML.",
            );
        }
    }
}
