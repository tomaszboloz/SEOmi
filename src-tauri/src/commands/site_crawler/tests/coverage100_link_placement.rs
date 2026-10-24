use crate::commands::site_crawler::link_placement::dom_zone;
use scraper::{Html, Selector};

fn zone(html: &str) -> &'static str {
    let document = Html::parse_document(html);
    let selector = Selector::parse("a").unwrap();
    dom_zone(&document.select(&selector).next().unwrap())
}

#[test]
fn coverage100_dom_zone_checks_each_navigation_and_chrome_signal() {
    for (html, expected) in [
        ("<nav><a href='/x'>x</a></nav>", "nav_breadcrumb"),
        (
            "<div role='navigation'><a href='/x'>x</a></div>",
            "nav_breadcrumb",
        ),
        (
            "<div role='banner'><a href='/x'>x</a></div>",
            "nav_breadcrumb",
        ),
        (
            "<div class='menu'><a href='/x'>x</a></div>",
            "nav_breadcrumb",
        ),
        ("<aside><a href='/x'>x</a></aside>", "sidebar_footer"),
        (
            "<div role='complementary'><a href='/x'>x</a></div>",
            "sidebar_footer",
        ),
        (
            "<div role='contentinfo'><a href='/x'>x</a></div>",
            "sidebar_footer",
        ),
        (
            "<div class='footer'><a href='/x'>x</a></div>",
            "sidebar_footer",
        ),
    ] {
        assert_eq!(zone(html), expected, "{html}");
    }
}
