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

#[test]
fn link_context_shows_anchor_window_heading_and_caps_rows() {
    use super::sec_link_context::{context_cell, link_context, MAX_ROWS};
    let with_context = json!({ "target_url": "https://e.test/b", "anchor_text": "guide", "is_internal": true,
        "zone": "main", "context_before": "read our", "context_after": "for details", "section_heading": "Basics" });
    assert_eq!(context_cell(&with_context), "read our [guide] for details");
    let only_after = json!({ "anchor_text": "x", "context_after": "tail" });
    assert_eq!(context_cell(&only_after), "[x] tail");
    let legacy =
        json!({ "target_url": "https://e.test/c", "anchor_text": "old", "is_internal": true });
    assert_eq!(context_cell(&legacy), "");
    let external =
        json!({ "target_url": "https://x.test/", "anchor_text": "ext", "is_internal": false });
    let mut links = vec![with_context, legacy, external];
    links.extend((0..MAX_ROWS).map(|i| json!({ "target_url": format!("https://e.test/{i}"), "anchor_text": "n", "is_internal": true })));
    let run = json!({ "result": { "pages": [{ "url": "https://e.test/", "links": links }] } });
    let table = link_context(&Crawl::new(&run));
    assert_eq!(table.rows.len(), MAX_ROWS);
    let first: Vec<String> = table.rows[0].iter().map(|c| c.text.clone()).collect();
    assert_eq!(
        first,
        [
            "https://e.test/",
            "https://e.test/b",
            "Main content",
            "read our [guide] for details",
            "Basics"
        ]
    );
    let second: Vec<String> = table.rows[1].iter().map(|c| c.text.clone()).collect();
    assert_eq!(second[2], "Unknown (older run)");
    assert_eq!(second[3], "—");
    assert!(table
        .intro
        .as_deref()
        .unwrap()
        .ends_with(&format!("{MAX_ROWS}/{}", MAX_ROWS + 2)));
}
