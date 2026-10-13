use super::ctx::{field, list_at, text_at};
use super::locate_tech::tech_items;
use super::strings::{loc as l, t};
use serde_json::Value;

/// Where a finding applies: the page plus every location datum available.
pub fn where_items(audit: &Value, code: &str, params: Option<&Value>) -> Vec<String> {
    let url = text_at(audit, "/final_url").unwrap_or_default();
    let mut specific = page_items(audit, code);
    if specific.is_empty() {
        specific = tech_items(audit, code, params);
    }
    let head = if specific.is_empty() {
        l::WHOLE_PAGE
    } else {
        l::PAGE
    };
    let mut items = vec![t(head, &[&url])];
    items.extend(specific);
    items
}

fn element(tag: &str, current: Option<String>) -> Vec<String> {
    let mut items = vec![t(l::ELEMENT, &[tag])];
    items.extend(current.map(|value| t(l::CURRENT, &[&value])));
    items
}

fn images_where(audit: &Value, keep: impl Fn(&Value) -> bool) -> Vec<String> {
    list_at(audit, "/images")
        .iter()
        .filter(|image| keep(image))
        .map(|image| t(l::IMAGE, &[&field(image, "src").unwrap_or_default()]))
        .collect()
}

fn links_where(audit: &Value, keep: impl Fn(&Value) -> bool) -> Vec<String> {
    list_at(audit, "/links/links")
        .iter()
        .filter(|link| keep(link))
        .map(|link| match field(link, "text") {
            Some(anchor) => t(
                l::LINK_TEXT,
                &[&field(link, "href").unwrap_or_default(), &anchor],
            ),
            None => t(l::LINK, &[&field(link, "href").unwrap_or_default()]),
        })
        .collect()
}

fn headings_where(audit: &Value, code: &str) -> Vec<String> {
    if code.starts_with("headings_hierarchy") {
        return list_at(audit, "/headings/issues")
            .iter()
            .filter_map(|issue| issue.as_str().map(str::to_owned))
            .collect();
    }
    let found: Vec<String> = list_at(audit, "/headings/h1_texts")
        .iter()
        .filter_map(|text| text.as_str().map(|text| t(l::H1, &[text])))
        .collect();
    if found.is_empty() {
        element("<h1>", None)
    } else {
        found
    }
}

fn page_items(audit: &Value, code: &str) -> Vec<String> {
    let meta = |key: &str| text_at(audit, &format!("/meta_tags/{key}"));
    let no_dimensions =
        |image: &Value| field(image, "width").is_none() || field(image, "height").is_none();
    let is = |prefix: &str| code.starts_with(prefix);
    if is("meta_title") {
        element("<title>", meta("title"))
    } else if is("meta_description") {
        element("<meta name=\"description\">", meta("description"))
    } else if is("meta_canonical") {
        element("<link rel=\"canonical\">", meta("canonical"))
    } else if is("meta_robots") {
        element("<meta name=\"robots\">", meta("robots"))
    } else if is("meta_viewport") {
        element("<meta name=\"viewport\">", meta("viewport"))
    } else if is("headings_") {
        headings_where(audit, code)
    } else if is("images_alt") {
        images_where(audit, |image| {
            image.get("has_alt") != Some(&Value::Bool(true))
        })
    } else if is("images_dimensions") {
        images_where(audit, no_dimensions)
    } else if is("links_insecure") {
        links_where(audit, |link| {
            link.get("is_insecure") == Some(&Value::Bool(true))
        })
    } else if is("links_target_blank") {
        links_where(audit, |link| {
            field(link, "target").as_deref() == Some("_blank")
                && !field(link, "rel").unwrap_or_default().contains("noopener")
        })
    } else if is("indexability_xrobots") {
        let header = text_at(audit, "/indexability/x_robots_tag");
        vec![t(l::HEADER, &["X-Robots-Tag"])]
            .into_iter()
            .chain(header.map(|value| t(l::CURRENT, &[&value])))
            .collect()
    } else {
        Vec::new()
    }
}
