use super::color::{CRITICAL, TEXT};
use super::doc::{Doc, CONTENT_W};
use super::table::{widths, Cell, Column};
use super::tests_doc::chrome;
use super::text::Style;
use crate::commands::pdf_report::tests::extract_pdf_text;

fn columns() -> Vec<Column> {
    vec![Column::new("HDRX", 1.0), Column::new("Value", 3.0)]
}

fn rows(count: usize) -> Vec<Vec<Cell>> {
    (0..count)
        .map(|n| vec![Cell::new(format!("row{n}")), Cell::new(format!("value{n}"))])
        .collect()
}

#[test]
fn column_weights_share_the_content_width() {
    let sizes = widths(&columns());
    assert!((sizes.iter().sum::<f32>() - CONTENT_W).abs() < 0.01);
    assert!((sizes[1] / sizes[0] - 3.0).abs() < 0.01);
}

#[test]
fn long_tables_repeat_the_header_on_every_page() {
    let mut doc = Doc::new(chrome());
    doc.table(&columns(), &rows(150));
    let pages = doc.page_count();
    assert!(pages >= 3);
    let text = extract_pdf_text(&doc.finish());
    assert_eq!(text.matches("HDRX").count(), pages);
    assert!(text.contains("value0") && text.contains("value149"));
}

#[test]
fn rows_that_fit_on_a_fresh_page_are_not_split() {
    let mut doc = Doc::new(chrome());
    doc.skip(600.0);
    let tall = vec![vec![Cell::new("TALLROW ".repeat(60)), Cell::new("x")]];
    doc.table(&columns(), &tall);
    assert_eq!(doc.page_count(), 2);
    let text = extract_pdf_text(&doc.finish());
    assert_eq!(text.matches("HDRX").count(), 1);
    assert_eq!(text.matches("TALLROW").count(), 60);
}

#[test]
fn rows_taller_than_a_page_continue_on_the_next_page() {
    let mut doc = Doc::new(chrome());
    let giant = "alpha beta gamma delta ".repeat(500) + "ENDMARK";
    doc.table(&columns(), &[vec![Cell::new(giant), Cell::new("x")]]);
    assert!(doc.page_count() >= 2);
    let text = extract_pdf_text(&doc.finish());
    assert_eq!(text.matches("alpha").count(), 500);
    assert!(text.contains("ENDMARK"));
}

#[test]
fn zebra_rows_and_cell_fills_are_drawn() {
    let mut doc = Doc::new(chrome());
    doc.cur.clear();
    let fill = CRITICAL.tint(0.88);
    let styled = Cell::styled("flag", Style::new(9.0, TEXT, true), Some(fill));
    doc.table(
        &columns(),
        &[
            vec![Cell::new("a"), Cell::new("b")],
            vec![styled, Cell::new("")],
        ],
    );
    assert!(doc.cur.contains(&fill.fill_op()));
    assert!(doc.cur.contains("0.976 0.980 0.984 rg"));
}

#[test]
fn empty_cells_show_the_missing_value_dash() {
    let mut doc = Doc::new(chrome());
    doc.table(&columns(), &[vec![Cell::new(""), Cell::new("  ")]]);
    let text = extract_pdf_text(&doc.finish());
    assert_eq!(text.matches('\u{2014}').count(), 2);
}
