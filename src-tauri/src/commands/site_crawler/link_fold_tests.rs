use super::link_placement::{build_link, LinkFacts};
use scraper::{Html, Selector};

fn placed(html: &str, rendered: bool) -> (Option<String>, Option<String>) {
    let doc = Html::parse_document(html);
    let sel = Selector::parse("a").unwrap();
    let facts = LinkFacts {
        target_url: "https://s.test/x".into(),
        anchor_text: "x".into(),
        rel: None,
        is_internal: true,
        source_excerpt: None,
        rendered,
    };
    let link = build_link(facts, &doc.select(&sel).next().unwrap());
    (link.zone, link.zone_method)
}

#[test]
fn rendered_viewport_mark_sets_fold_only_for_main_content_on_rendered_pages() {
    let above = "<main><a data-seomi-fold=above href=/x>x</a></main>";
    let below = "<main><a data-seomi-fold=below href=/x>x</a></main>";
    let some = |a: &str, b: &str| (Some(a.to_owned()), Some(b.to_owned()));
    assert_eq!(placed(above, true), some("above_fold", "rendered-viewport"));
    assert_eq!(placed(below, true), some("below_fold", "rendered-viewport"));
    // HTTP pages can carry the attribute in their source; it is not trusted there.
    assert_eq!(placed(above, false), some("main", "dom-ancestry"));
    let nav = "<nav><a data-seomi-fold=above href=/x>x</a></nav>";
    assert_eq!(placed(nav, true), some("nav_breadcrumb", "dom-ancestry"));
    assert_eq!(
        placed("<main><a href=/x>x</a></main>", true),
        some("main", "dom-ancestry")
    );
}
