use super::fixture::fixture;
use super::locate::where_items;
use serde_json::json;

fn at(code: &str) -> Vec<String> {
    where_items(&fixture(), code, None)
}

fn has(items: &[String], part: &str) -> bool {
    items.iter().any(|item| item.contains(part))
}

#[test]
fn unknown_codes_apply_to_the_whole_page() {
    assert_eq!(
        at("something_else"),
        vec!["Whole page: https://example.test/page"]
    );
    let bare = where_items(&json!({}), "", None);
    assert_eq!(bare, vec!["Whole page: "]);
}

#[test]
fn meta_codes_name_the_head_element_and_its_current_value() {
    let title = at("meta_title_short");
    assert_eq!(title[0], "Page: https://example.test/page");
    assert!(has(&title, "Element: <title>") && has(&title, "Current value: Example"));
    assert!(has(
        &at("meta_description_missing"),
        "<meta name=\"description\">"
    ));
    assert!(has(
        &at("meta_canonical_missing"),
        "<link rel=\"canonical\">"
    ));
    assert!(has(&at("meta_robots_noindex"), "<meta name=\"robots\">"));
    let viewport = at("meta_viewport_missing");
    assert!(has(&viewport, "Current value: width=device-width"));
}

#[test]
fn heading_codes_list_h1_texts_or_hierarchy_problems() {
    let multiple = at("headings_h1_multiple");
    assert!(has(&multiple, "Heading <h1>: One") && has(&multiple, "Heading <h1>: Two"));
    assert!(has(
        &at("headings_hierarchy_skip"),
        "Heading level skipped: h1 to h3"
    ));
    let none = where_items(
        &json!({"final_url": "u", "headings": {"h1_texts": []}}),
        "headings_h1_missing",
        None,
    );
    assert!(has(&none, "Element: <h1>"));
}

#[test]
fn image_and_link_codes_list_every_affected_url() {
    assert!(has(
        &at("images_alt_missing"),
        "Image: https://cdn.test/a.png"
    ));
    assert!(has(
        &at("images_dimensions_missing"),
        "Image: https://cdn.test/a.png"
    ));
    assert!(has(
        &at("links_insecure"),
        "Link: http://insecure.test/ (anchor text: Old)"
    ));
    assert!(has(
        &at("links_target_blank"),
        "Link: http://insecure.test/"
    ));
    let audit = json!({"final_url": "u", "links": {"links": [
        {"href": "http://a.test/", "text": "", "is_insecure": true},
        {"href": "http://b.test/", "target": "_blank", "rel": "noopener"}]}});
    assert!(has(
        &where_items(&audit, "links_insecure", None),
        "Link: http://a.test/"
    ));
    assert_eq!(where_items(&audit, "links_target_blank", None).len(), 1);
}
