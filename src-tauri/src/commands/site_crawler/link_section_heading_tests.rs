use super::link_section_heading::section_heading;
use scraper::{Html, Selector};

fn heading_of(html: &str, anchor: &str) -> Option<String> {
    let doc = Html::parse_document(html);
    let sel = Selector::parse(&format!("a[href='{anchor}']")).unwrap();
    let element = doc.select(&sel).next().unwrap();
    section_heading(&element)
}

#[test]
fn takes_the_nearest_h2_or_h3_before_the_anchor() {
    let html = "<main><h1>Title</h1><p><a href=/a>a</a></p>\
        <section><h2> Pricing \n plans </h2><div><p>x <a href=/b>b</a></p></div></section>\
        <h3>FAQ</h3><ul><li><a href=/c>c</a></li></ul>\
        <div><h2>Inner</h2><h3>Deeper</h3></div><p><a href=/d>d</a></p></main>";
    assert_eq!(heading_of(html, "/a"), None);
    assert_eq!(heading_of(html, "/b").as_deref(), Some("Pricing plans"));
    assert_eq!(heading_of(html, "/c").as_deref(), Some("FAQ"));
    assert_eq!(heading_of(html, "/d").as_deref(), Some("Deeper"));
}

#[test]
fn skips_empty_headings_and_truncates_long_ones() {
    let empty = "<h2> </h2><p><a href=/x>x</a></p>";
    assert_eq!(heading_of(empty, "/x"), None);
    let long = format!("<h2>{}</h2><p><a href=/y>y</a></p>", "w".repeat(400));
    assert_eq!(
        heading_of(&long, "/y").map(|h| h.chars().count()),
        Some(160)
    );
}

#[test]
fn gives_up_without_a_guess_when_the_scan_budget_runs_out() {
    let filler = "<span>t</span>".repeat(2_000);
    let html = format!("<h2>Far</h2><div>{filler}</div><p><a href=/z>z</a></p>");
    assert_eq!(heading_of(&html, "/z"), None);
}
