use super::doc::{Doc, CONTENT_W, MARGIN};
use super::table::{Cell, Column};
use super::tests_doc::chrome;

fn arabic_doc() -> Doc {
    let mut chrome = chrome();
    chrome.title = "\u{62a}\u{642}\u{631}\u{64a}\u{631}".into();
    Doc::new(chrome)
}

#[test]
fn latin_reports_lay_columns_out_from_the_left_margin() {
    let doc = Doc::new(chrome());
    assert_eq!(doc.column_left(0.0, 100.0), MARGIN);
    assert_eq!(doc.column_left(100.0, 50.0), MARGIN + 100.0);
}

#[test]
fn arabic_reports_lay_columns_out_from_the_right_margin() {
    let doc = arabic_doc();
    let right = MARGIN + CONTENT_W;
    assert_eq!(doc.column_left(0.0, 100.0), right - 100.0);
    assert_eq!(doc.column_left(100.0, 50.0), right - 150.0);
}

#[test]
fn arabic_tables_render_with_mirrored_columns() {
    let mut doc = arabic_doc();
    let columns = [Column::new("A", 1.0), Column::new("B", 2.0)];
    let rows = vec![vec![
        Cell::new("x"),
        Cell::new("\u{62a}\u{642}\u{631}\u{64a}\u{631}"),
    ]];
    doc.table(&columns, &rows);
    assert!(doc.page_count() >= 1);
}

fn plain() -> super::text::Style {
    super::text::Style::new(8.0, super::color::TEXT, false)
}

#[test]
fn latin_cell_text_starts_at_the_left_padding() {
    let mut doc = Doc::new(chrome());
    doc.cell_text(50.0, 100.0, 40.0, plain(), "abc");
    let mut expected = Doc::new(chrome());
    expected.text(50.0 + super::table::PAD_X, 40.0, plain(), "abc");
    assert_eq!(doc.cur, expected.cur);
}

#[test]
fn arabic_cell_text_ends_at_the_right_padding() {
    let mut doc = arabic_doc();
    doc.cell_text(50.0, 100.0, 40.0, plain(), "abc");
    let mut expected = arabic_doc();
    expected.text_right(150.0 - super::table::PAD_X, 40.0, plain(), "abc");
    assert_eq!(doc.cur, expected.cur);
}
