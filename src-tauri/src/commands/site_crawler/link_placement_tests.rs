use super::link_placement::{build_link, context_words, dom_zone, LinkFacts};
use scraper::{Html, Selector};

fn first_link(html: &str) -> (Html, Selector) {
    (Html::parse_document(html), Selector::parse("a").unwrap())
}

fn zone_of(html: &str) -> &'static str {
    let (doc, sel) = first_link(html);
    dom_zone(&doc.select(&sel).next().unwrap())
}

#[test]
fn zones_come_from_dom_ancestry_and_never_claim_a_fold() {
    assert_eq!(zone_of("<main><p><a href=/x>x</a></p></main>"), "main");
    assert_eq!(
        zone_of("<header><nav><a href=/x>x</a></nav></header>"),
        "nav_breadcrumb"
    );
    assert_eq!(
        zone_of("<div class='breadcrumbs'><a href=/x>x</a></div>"),
        "nav_breadcrumb"
    );
    assert_eq!(
        zone_of("<div role='navigation'><a href=/x>x</a></div>"),
        "nav_breadcrumb"
    );
    assert_eq!(
        zone_of("<main><aside><a href=/x>x</a></aside></main>"),
        "sidebar_footer"
    );
    assert_eq!(
        zone_of("<footer><a href=/x>x</a></footer>"),
        "sidebar_footer"
    );
    assert_eq!(
        zone_of("<div role='contentinfo'><a href=/x>x</a></div>"),
        "sidebar_footer"
    );
    assert_eq!(
        zone_of("<main><div id='related-widget'><a href=/x>x</a></div></main>"),
        "widget"
    );
    assert_eq!(zone_of("<div><a href=/x>x</a></div>"), "unknown");
    assert_eq!(zone_of("<div role='main'><a href=/x>x</a></div>"), "main");
    // Nested chrome inside main wins over main.
    assert_eq!(
        zone_of("<main><nav><a href=/x>x</a></nav></main>"),
        "nav_breadcrumb"
    );
    assert_eq!(
        zone_of("<div role='banner'><a href=/x>x</a></div>"),
        "nav_breadcrumb"
    );
    assert_eq!(
        zone_of("<div role='complementary'><a href=/x>x</a></div>"),
        "sidebar_footer"
    );
    assert_eq!(
        zone_of("<div class='sidebar'><a href=/x>x</a></div>"),
        "sidebar_footer"
    );
}

fn ctx(html: &str) -> (Option<String>, Option<String>) {
    let (doc, sel) = first_link(html);
    context_words(&doc.select(&sel).next().unwrap())
}

#[test]
fn context_keeps_at_most_fifteen_words_each_side_with_unicode() {
    let before: Vec<String> = (1..=20).map(|n| format!("b{n}")).collect();
    let after: Vec<String> = (1..=20).map(|n| format!("a{n}")).collect();
    let html = format!(
        "<p>{} <a href=/x>zażółć <b>gęślą</b></a> {}</p>",
        before.join(" "),
        after.join(" ")
    );
    let (b, a) = ctx(&html);
    assert_eq!(
        b.unwrap(),
        (6..=20)
            .map(|n| format!("b{n}"))
            .collect::<Vec<_>>()
            .join(" ")
    );
    assert_eq!(
        a.unwrap(),
        (1..=15)
            .map(|n| format!("a{n}"))
            .collect::<Vec<_>>()
            .join(" ")
    );
    let (b, a) = ctx("<p>Zażółć <a href=/x>x</a></p>");
    assert_eq!((b.as_deref(), a), (Some("Zażółć"), None));
}

#[test]
fn context_is_absent_without_block_or_when_block_is_huge() {
    assert_eq!(ctx("<a href=/x>x</a>"), (None, None));
    let many = "<i>w</i>".repeat(500);
    assert_eq!(
        ctx(&format!("<div>{many}<a href=/x>x</a></div>")),
        (None, None)
    );
}

#[test]
fn build_link_records_zone_method_and_leaves_target_checks_empty() {
    let (doc, sel) = first_link("<main><p>see <a href=/x>this</a> now</p></main>");
    let el = doc.select(&sel).next().unwrap();
    let link = build_link(
        LinkFacts {
            target_url: "https://s.test/x".into(),
            anchor_text: "this".into(),
            rel: None,
            is_internal: true,
            source_excerpt: None,
            rendered: false,
        },
        &el,
    );
    assert_eq!(
        (link.zone.as_deref(), link.zone_method.as_deref()),
        (Some("main"), Some("dom-ancestry"))
    );
    assert_eq!(
        (
            link.context_before.as_deref(),
            link.context_after.as_deref()
        ),
        (Some("see"), Some("now"))
    );
    assert!(link.target_http_status.is_none() && link.target_checked_at.is_none());
}

#[test]
fn older_snapshots_without_placement_fields_still_load() {
    let old = r#"{"target_url":"https://s.test/","anchor_text":"a","rel":null,"is_internal":true,"target_http_status":null}"#;
    let link: crate::commands::site_crawler::models::CrawledLink =
        serde_json::from_str(old).unwrap();
    assert!(link.zone.is_none() && link.context_before.is_none());
}

#[path = "tests/coverage100_link_placement.rs"]
mod coverage100_link_placement;
