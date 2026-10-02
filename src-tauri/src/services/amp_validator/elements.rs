use super::findings::add_finding;
use crate::models::audit_data::AmpFinding;
use scraper::{Html, Selector};

const MAX_COMPONENTS: usize = 64;

pub(super) fn check(document: &Html, findings: &mut Vec<AmpFinding>) {
    let forbidden_element_selector =
        Selector::parse("img,iframe,frame,frameset,object,embed,video,audio").unwrap();
    let inline_handler_selector = Selector::parse("*[onload],*[onclick],*[onerror],*[onchange],*[onsubmit],*[oninput],*[onfocus],*[onblur],*[onmouseover],*[onkeydown],*[onkeyup],*[onkeypress]").unwrap();
    for element in document
        .select(&forbidden_element_selector)
        .take(MAX_COMPONENTS)
    {
        let tag = element.value().name().to_ascii_lowercase();
        add_finding(
        findings,
        "amp-element-not-allowed",
        "error",
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
    if document.select(&forbidden_element_selector).count() > MAX_COMPONENTS {
        add_finding(
            findings,
            "amp-component-limit",
            "info",
            "AMP element validation reached its safety limit.".into(),
            format!("At most {MAX_COMPONENTS} forbidden element instances are retained."),
            "Review additional elements manually with the official AMP validator.",
        );
    }

    for element in document
        .select(&inline_handler_selector)
        .take(MAX_COMPONENTS)
    {
        let tag = element.value().name();
        let handler = element
            .value()
            .attrs()
            .find(|(name, _)| name.to_ascii_lowercase().starts_with("on"))
            .map(|(name, _)| name)
            .unwrap_or("on*");
        add_finding(
            findings,
            "amp-inline-event-handler",
            "error",
            "The AMP document contains an inline event-handler attribute.".into(),
            format!("<{tag} {handler}=…>"),
            "Move interaction to an AMP action/event declaration or an allowed AMP component.",
        );
    }
}
