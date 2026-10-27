use super::extract_page_focus;
use scraper::Html;

fn focus(
    html: &str,
    language: &str,
    title: Option<&str>,
) -> crate::commands::site_crawler::models::CrawledPageFocus {
    extract_page_focus(
        &Html::parse_document(html),
        Some(language),
        title,
        Some("Meta about coffee"),
    )
}

#[test]
fn zones_weight_title_and_h1_above_body() {
    let html = "<html><body><main><h1>Coffee roasting</h1><h2>Beans</h2>\
        <p>Coffee roasting needs beans. Coffee roasting at home.</p></main></body></html>";
    let page = focus(html, "en", Some("Coffee guide"));
    let coffee = page
        .focus_terms
        .iter()
        .find(|t| t.term == "coffee")
        .unwrap();
    // body 3 + title 2.5 + meta 1.0 + h1 extra 1.5; extra weight is not counted
    assert_eq!(coffee.count, 5);
    assert_eq!(coffee.weight, 8.0);
    let beans = page.focus_terms.iter().find(|t| t.term == "bean").unwrap();
    assert_eq!(beans.surface, "beans");
    assert_eq!((beans.count, beans.weight), (2, 2.5));
}

#[test]
fn bigrams_need_repetition_or_emphasis() {
    let html = "<html><body><main><p>Coffee roasting is fun. Coffee roasting rocks. Green tea.</p>\
        </main></body></html>";
    let page = focus(html, "en", None);
    assert!(page
        .focus_terms
        .iter()
        .any(|t| t.term == "coffee roasting" && t.count == 2));
    assert!(!page.focus_terms.iter().any(|t| t.term == "green tea"));
}

#[test]
fn ngrams_do_not_cross_stopwords_or_sentences() {
    let page = focus(
        "<body><main><p>Search of engines. Engines search.</p></main></body>",
        "en",
        None,
    );
    assert!(page
        .focus_terms
        .iter()
        .all(|t| !t.term.contains("search engine")));
}

#[test]
fn headings_are_collected_bounded_and_skip_chrome() {
    let long = "x".repeat(300);
    let many = (0..30)
        .map(|i| format!("<h2>Section {i}</h2>"))
        .collect::<String>();
    let html = format!(
        "<html><body><nav><h2>Menu</h2></nav><main><h1>{long}</h1>{many}<h3>Detail</h3></main></body></html>"
    );
    let page = focus(&html, "en", None);
    assert_eq!(page.heading_texts.h1[0].chars().count(), 160);
    assert_eq!(page.heading_texts.h2.len(), 20);
    assert!(!page.heading_texts.h2.iter().any(|h| h == "Menu"));
    assert_eq!(page.heading_texts.h3, vec!["Detail".to_string()]);
}

#[test]
fn extra_language_stopwords_are_filtered() {
    let page = focus(
        "<body><main><p>Der Kaffee und die Rösterei. Kaffee Rösterei.</p></main></body>",
        "de",
        None,
    );
    assert!(page
        .focus_terms
        .iter()
        .all(|t| t.term != "und" && t.term != "die" && t.term != "der"));
    assert!(page.focus_terms.iter().any(|t| t.term == "kaffee"));
}

#[test]
fn terms_are_capped_and_alt_text_counts() {
    let words = (0..400)
        .map(|i| format!("topic{}word", "abcdefghij".to_string() + &i.to_string()))
        .collect::<Vec<_>>()
        .join(" ");
    let html = format!("<body><main><p>{words}</p><img alt=\"lighthouse\"></main></body>");
    let page = focus(&html, "en", None);
    assert_eq!(page.focus_terms.len(), 120);
    assert!(page.focus_text_chars > 1000);
    let alt = focus(
        "<body><main><p>text</p><img alt=\"lighthouse\"></main></body>",
        "en",
        None,
    );
    assert!(alt.focus_terms.iter().any(|t| t.term == "lighthouse"));
}

#[test]
fn chrome_images_are_ignored_and_header_headings_use_the_outer_zone() {
    let page = focus(
        "<body><header><h3>Header label</h3></header><main><h2></h2><p>Body text.</p></main><footer><img alt='footer-only'></footer></body>",
        "en",
        None,
    );
    assert!(!page.focus_terms.iter().any(|term| term.term == "footer"));
    assert!(page
        .heading_texts
        .h3
        .iter()
        .any(|heading| heading == "Header label"));
}

#[test]
fn old_saved_runs_without_focus_fields_still_load() {
    let page: crate::commands::site_crawler::models::CrawledPageFocus =
        serde_json::from_str("{}").unwrap();
    assert!(page.focus_terms.is_empty() && page.focus_text_chars == 0);
}

#[path = "coverage100_focus_terms.rs"]
mod coverage100_focus_terms;
