use super::color::{CRITICAL, MUTED, OK, WARNING};
use super::doc::Doc;
use super::table::{Cell, Column};
use super::tests_doc::chrome;
use super::widgets::{score_color, Kpi};
use crate::commands::pdf_report::tests::extract_pdf_text;

#[test]
fn score_colours_follow_the_thresholds() {
    assert_eq!(score_color(Some(80.0)), OK);
    assert_eq!(score_color(Some(50.0)), WARNING);
    assert_eq!(score_color(Some(49.9)), CRITICAL);
    assert_eq!(score_color(None), MUTED);
}

#[test]
fn score_panel_shows_number_rating_and_bar() {
    let mut doc = Doc::new(chrome());
    let top = doc.y;
    doc.score_panel(Some(53.0), "Needs work", "Health", "legend text");
    assert!(doc.y > top + 80.0);
    doc.score_panel(None, "Not scored", "Health", "legend text");
    let text = extract_pdf_text(&doc.finish());
    for part in [
        "53",
        "/ 100",
        "Needs work",
        "Health",
        "legend text",
        "Not scored",
        "\u{2014}",
    ] {
        assert!(text.contains(part), "missing {part}");
    }
}

#[test]
fn count_cards_facts_rows_and_headings_advance_the_cursor() {
    let mut doc = Doc::new(chrome());
    let start = doc.y;
    doc.count_cards(&[(CRITICAL, "Critical", 3), (OK, "Fine", 0)], "issues");
    doc.facts_row(&[("LABEL", "value".into()), ("OTHER", "x".repeat(300))]);
    doc.heading("Section");
    assert!(doc.y > start + 100.0);
    let text = extract_pdf_text(&doc.finish());
    for part in ["Critical", "issues", "LABEL", "value", "OTHER", "Section"] {
        assert!(text.contains(part), "missing {part}");
    }
    assert!(
        text.contains('\u{2026}'),
        "long fact is shortened with an ellipsis"
    );
}

#[test]
fn kpi_grid_wraps_into_rows_of_four_and_paginates() {
    let mut doc = Doc::new(chrome());
    let cards: Vec<Kpi> = (0..80)
        .map(|n| Kpi {
            label: "LABEL",
            value: n.to_string(),
            note: "note".into(),
            color: OK,
        })
        .collect();
    doc.kpi_grid(&cards);
    assert!(doc.page_count() >= 2);
    let text = extract_pdf_text(&doc.finish());
    assert_eq!(text.matches("LABEL").count(), 80);
    assert!(text.contains("79"));
}

#[test]
fn table_need_covers_the_header_and_the_first_row() {
    let doc = Doc::new(chrome());
    let columns = [Column::new("A", 1.0)];
    let small = doc.table_need(&columns, &[vec![Cell::new("x")]]);
    let tall = doc.table_need(&columns, &[vec![Cell::new("word ".repeat(200))]]);
    assert!(small > 17.0 && tall > small);
    let giant = doc.table_need(&columns, &[vec![Cell::new("word ".repeat(20_000))]]);
    assert!(
        giant < 100.0,
        "rows taller than a page only need a few lines"
    );
    assert!(doc.table_need(&columns, &[]) > 17.0);
}
