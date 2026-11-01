use super::link_context::{link_context, LinkContext};
use scraper::{Html, Selector};

fn context(html: &str) -> LinkContext {
    let doc = Html::parse_document(html);
    let sel = Selector::parse("a").unwrap();
    link_context(&doc.select(&sel).next().unwrap())
}

fn words(prefix: &str, count: usize) -> String {
    (1..=count)
        .map(|n| format!("{prefix}{n}"))
        .collect::<Vec<_>>()
        .join(" ")
}

#[test]
fn short_blocks_report_the_anchor_offset_and_no_truncation() {
    let found = context("<p>one two <a href=/x>x</a> three</p>");
    assert_eq!(found.before.as_deref(), Some("one two"));
    assert_eq!(found.after.as_deref(), Some("three"));
    assert!(!found.truncated);
    assert_eq!(found.anchor_offset, Some(2));
}

#[test]
fn long_blocks_are_marked_truncated_on_either_side() {
    let before_cut = context(&format!("<p>{} <a href=/x>x</a></p>", words("b", 16)));
    assert!(before_cut.truncated);
    assert_eq!(before_cut.anchor_offset, Some(16));
    let after_cut = context(&format!("<p><a href=/x>x</a> {}</p>", words("a", 16)));
    assert!(after_cut.truncated);
    assert_eq!(after_cut.anchor_offset, Some(0));
    let exact = context(&format!(
        "<p>{} <a href=/x>x</a> {}</p>",
        words("b", 15),
        words("a", 15)
    ));
    assert!(!exact.truncated);
}

#[test]
fn no_block_or_huge_block_gives_no_evidence() {
    assert_eq!(context("<a href=/x>x</a>"), LinkContext::default());
    let many = "<b>w</b>".repeat(450);
    assert_eq!(
        context(&format!("<p>{many}<a href=/x>x</a></p>")),
        LinkContext::default()
    );
}
