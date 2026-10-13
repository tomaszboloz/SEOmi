use super::data::Crawl;
use super::fixture_run::run;
use super::pages::{critical_table, pages_table};
use super::run_tables::{configuration, display, robots_sitemap, run_details};
use super::sec_dupes::duplicates;
use super::sec_extra::frames_and_searches;
use super::sec_http::http_details;
use super::sec_links::{broken_links, external_links};
use super::sec_media::{image_problems, images, resources};
use super::sec_meta::{canonicals, hreflang};
use super::sec_nav::{amp, pagination};
use super::sec_redirects::{client_redirects, redirects};
use super::sec_robots::{indexability_reasons, robots_rules, sitemap_and_rejected};
use super::sec_schema::{html_validation, structured_data};
use super::tables::{status_cell, Table, MAX_ROWS};
use serde_json::json;

fn cells(table: &Table) -> Vec<String> {
    table
        .rows
        .iter()
        .flatten()
        .map(|cell| cell.text.clone())
        .collect()
}

fn has(table: &Table, part: &str) -> bool {
    cells(table).iter().any(|cell| cell.contains(part))
}

#[test]
fn run_tables_show_every_stored_setting_and_robots_detail() {
    let run = run();
    let c = Crawl::new(&run);
    let config = configuration(&c);
    for part in ["Yes", "None", "x, y", "\u{2014}", "{\"k\":1}", "3", "s"] {
        assert!(has(&config, part), "config misses {part}");
    }
    assert!(has(&run_details(&c), "2 of 9 pages kept"));
    assert!(has(&robots_sitemap(&c), "w"));
    let none = json!({});
    assert!(has(&configuration(&Crawl::new(&none)), "\u{2014}"));
    assert_eq!(display(&json!(["a", true])), "a, Yes");
}

#[test]
fn duplicate_redirect_and_link_tables_list_every_url() {
    let run = run();
    let c = Crawl::new(&run);
    let dupes = duplicates(&c);
    assert!(has(&dupes[0], "https://e.test/b") && has(&dupes[1], "D"));
    assert!(has(&dupes[2], "Content hash abcdef012345 (Same)"));
    assert!(has(&dupes[3], "Near-duplicate content with"));
    let redirects = redirects(&c);
    assert!(has(&redirects, "301 \u{2192} https://e.test/") && has(&redirects, "loop"));
    assert!(has(&client_redirects(&c), "0;url=/x"));
    let broken = broken_links(&c);
    assert_eq!(broken.rows.len(), 2);
    assert!(cells(&broken)[4] == "Internal" && has(&broken, "404"));
    assert!(has(&broken, "timeout"));
    let external = external_links(&c);
    assert!(has(&external, "x.test") && has(&external, "404") && has(&external, "not checked"));
    assert_eq!(status_cell(Some("301".into())).text, "301");
    assert_eq!(status_cell(None).text, "\u{2014}");
}

#[test]
fn metadata_tables_cover_canonical_hreflang_pagination_and_amp() {
    let run = run();
    let c = Crawl::new(&run);
    assert!(
        has(&canonicals(&c), "https://c.test/ (HTTP \u{2014})") && has(&canonicals(&c), "missing")
    );
    let tags = hreflang(&c);
    assert!(has(&tags, "Problem") && has(&tags, "OK") && has(&tags, "Yes"));
    assert!(has(&pagination(&c), "page") && has(&amp(&c), "https://e.test/amp"));
}

#[test]
fn media_schema_and_robots_tables_are_complete() {
    let run = run();
    let c = Crawl::new(&run);
    let imgs = images(&c);
    assert_eq!(imgs.rows.len(), 1);
    assert!(has(
        &imgs,
        "no alt, no width/height, request failed, over 200 KB"
    ));
    assert!(image_problems(&json!({"alt": "", "width": 1, "height": 1})).is_empty());
    assert!(has(&resources(&c), "1 pages, e.g. https://e.test/"));
    let extra = frames_and_searches(&c);
    assert!(has(&extra[0], "https://f.test/") && has(&extra[1], "v1; v2"));
    assert!(
        has(&structured_data(&c), "json-ld #0 $.a: bad") && has(&structured_data(&c), "Article")
    );
    assert!(has(&html_validation(&c), "div (line 3, column 4)"));
    let robots = robots_rules(&c);
    assert!(
        has(&robots[0], "Disallow")
            && has(&robots[1], "Allow: /")
            && has(&robots[2], "s.xml")
            && has(&robots[3], "301")
    );
    let sitemap = sitemap_and_rejected(&c);
    assert!(has(&sitemap[0], "s1") && has(&sitemap[1], "scope"));
    assert!(has(&indexability_reasons(&c), "robots.txt"));
    let http = http_details(&c);
    assert!(http.intro.as_deref().unwrap().starts_with("1 of 2 pages") && has(&http, "start"));
}

#[test]
fn pages_and_critical_tables_and_row_caps() {
    let run = run();
    let c = Crawl::new(&run);
    assert_eq!(pages_table(c.pages).rows.len(), 2);
    let critical = critical_table(c.pages);
    assert_eq!(critical.rows.len(), 1);
    assert!(has(&critical, "Boom"));
    let rows = (0..MAX_ROWS + 5).map(|i| vec![i.to_string()]).collect();
    let capped = Table::text("t", None, &[("c", 1.0)], rows);
    assert_eq!((capped.rows.len(), capped.omitted), (MAX_ROWS, 5));
}

#[test]
fn long_lists_state_how_many_rows_were_left_out() {
    use crate::commands::pdf_report::layout::doc::{Chrome, Doc};
    use crate::commands::pdf_report::tests::extract_pdf_text;
    let chrome = Chrome {
        title: "t".into(),
        subtitle: "s".into(),
        date: "d".into(),
        note: "n".into(),
        brand: "b".into(),
        page_label: "{page}".into(),
    };
    let mut doc = Doc::new(chrome);
    let rows = (0..MAX_ROWS + 7).map(|i| vec![format!("row{i}")]).collect();
    doc.data_table(&Table::text(
        "Big",
        Some("intro".into()),
        &[("c", 1.0)],
        rows,
    ));
    doc.data_table(&Table::text("Empty", None, &[("c", 1.0)], vec![]));
    let text = extract_pdf_text(&doc.finish());
    assert!(text.contains("+ 7 more rows not shown here"));
    assert!(text.contains(&format!("row{}", MAX_ROWS - 1)));
    assert!(!text.contains(&format!("row{MAX_ROWS}")));
    assert!(text.contains("None found in this run."));
}
