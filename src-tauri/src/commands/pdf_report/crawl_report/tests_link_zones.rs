use super::data::Crawl;
use super::sec_link_zones::link_zones;
use serde_json::json;

#[test]
fn link_zones_count_internal_links_per_zone_with_reference_weights() {
    let link = |zone: Option<&str>, internal: bool| {
        let mut value = json!({ "target_url": "https://e.test/x", "anchor_text": "x", "is_internal": internal });
        if let Some(zone) = zone {
            value["zone"] = json!(zone);
        }
        value
    };
    let run = json!({ "result": { "pages": [
        { "url": "https://e.test/", "links": [link(Some("nav_breadcrumb"), true), link(Some("nav_breadcrumb"), true), link(Some("main"), true), link(Some("widget"), false)] },
        { "url": "https://e.test/a", "links": [link(Some("nav_breadcrumb"), true), link(None, true)] }
    ] } });
    let table = link_zones(&Crawl::new(&run));
    let rows: Vec<Vec<String>> = table
        .rows
        .iter()
        .map(|row| row.iter().map(|cell| cell.text.clone()).collect())
        .collect();
    assert_eq!(rows.len(), 3);
    assert_eq!(rows[0], ["Main content", "1", "20.0%", "1", "neutral (1)"]);
    assert_eq!(
        rows[1],
        ["Navigation / breadcrumb", "3", "60.0%", "2", "0.25"]
    );
    assert_eq!(
        rows[2],
        ["Unknown (older run)", "1", "20.0%", "1", "neutral (1)"]
    );
}
