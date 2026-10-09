use super::fold_fragment_rows;
use serde_json::{json, Value};

fn row(page: &str, clicks: f64, impressions: f64, ctr: f64, position: f64) -> Value {
    json!({"page": page, "clicks": clicks, "impressions": impressions, "ctr": ctr, "position": position})
}

#[test]
fn jump_links_fold_into_the_document_without_adding_impressions_twice() {
    let folded = fold_fragment_rows(
        vec![
            row("https://site.test/guide/", 9.0, 1869.0, 0.5, 4.8),
            row("https://site.test/other/", 3.0, 30.0, 10.0, 2.0),
            row("https://site.test/guide/#what", 2.0, 456.0, 0.4, 4.2),
            row("https://site.test/guide/#how", 0.0, 438.0, 0.0, 4.2),
        ],
        None,
    );
    assert_eq!(
        folded,
        vec![
            row("https://site.test/guide/", 11.0, 1869.0, 0.6, 4.8),
            row("https://site.test/other/", 3.0, 30.0, 10.0, 2.0),
        ]
    );
}

#[test]
fn fragments_without_their_document_take_the_most_shown_row() {
    let folded = fold_fragment_rows(
        vec![
            row("https://site.test/a/#one", 1.0, 40.0, 2.5, 6.0),
            row("https://site.test/a/#two", 1.0, 90.0, 1.1, 3.0),
            row("https://site.test/b/#only", 0.0, 0.0, 0.0, 9.0),
            row("https://site.test/b/#zero", 0.0, 0.0, 0.0, 7.0),
        ],
        None,
    );
    assert_eq!(
        folded,
        vec![
            row("https://site.test/a/", 2.0, 90.0, 2.2, 3.0),
            row("https://site.test/b/", 0.0, 0.0, 0.0, 9.0),
        ]
    );
}

#[test]
fn query_page_pairs_fold_per_query_and_untouched_rows_keep_their_metrics() {
    let pair = |query: &str, page: &str, clicks: f64, impressions: f64| json!({"query": query, "page": page, "clicks": clicks, "impressions": impressions, "ctr": 1.3, "position": 2.0});
    let folded = fold_fragment_rows(
        vec![
            pair("sends", "https://site.test/guide/", 2.0, 100.0),
            pair("sends", "https://site.test/guide/#what", 1.0, 97.0),
            pair("saves", "https://site.test/guide/#what", 0.0, 50.0),
            json!({"query": "no page"}),
        ],
        Some("query"),
    );
    assert_eq!(folded.len(), 3);
    assert_eq!(folded[0]["clicks"], json!(3.0));
    assert_eq!(folded[0]["impressions"], json!(100.0));
    assert_eq!(folded[0]["ctr"], json!(3.0));
    assert_eq!(
        folded[1],
        pair("saves", "https://site.test/guide/", 0.0, 50.0)
    );
    assert_eq!(folded[2], json!({"query": "no page"}));
}
