use super::color::{Rgb, BRAND, OK};
use super::doc::{Chrome, Doc, PAGE_H, TOP};
use super::text::{dash, Style, EMPTY};
use crate::commands::pdf_report::tests::{extract_pdf_text, pdf_has_text};

pub(super) fn chrome() -> Chrome {
    Chrome {
        title: "Test report".into(),
        subtitle: "https://example.test/page".into(),
        date: "2026-01-01".into(),
        note: "A method note".into(),
        brand: "Made by tests".into(),
        page_label: "Page {{page}} of {{total}}".into(),
    }
}

#[test]
fn colours_produce_pdf_operators_and_tints() {
    assert_eq!(Rgb(255, 0, 0).fill_op(), "1.000 0.000 0.000 rg\n");
    assert_eq!(Rgb(0, 0, 255).stroke_op(), "0.000 0.000 1.000 RG\n");
    assert_eq!(BRAND.tint(0.0), BRAND);
    assert_eq!(OK.tint(1.0), Rgb(255, 255, 255));
    assert_eq!(Rgb(0, 100, 200).tint(0.5), Rgb(128, 178, 228));
}

#[test]
fn every_page_carries_header_and_numbered_footer() {
    let mut doc = Doc::new(chrome());
    doc.new_page();
    assert_eq!(doc.page_count(), 2);
    let bytes = doc.finish();
    let text = extract_pdf_text(&bytes);
    assert_eq!(text.matches("Test report").count(), 2);
    assert_eq!(text.matches("Made by tests").count(), 2);
    assert_eq!(text.matches("A method note").count(), 2);
    assert!(text.contains("Page 1 of 2") && text.contains("Page 2 of 2"));
    let raw = String::from_utf8_lossy(&bytes);
    assert!(raw.contains("/MediaBox [0 0 595.28 841.89]"));
    assert!(raw.contains("/Count 2"));
}

#[test]
fn ensure_only_breaks_when_content_is_already_on_the_page() {
    let mut doc = Doc::new(chrome());
    assert_eq!(doc.y, TOP);
    doc.ensure(100_000.0);
    assert_eq!(doc.page_count(), 1);
    doc.skip(100.0);
    doc.ensure(10.0);
    assert_eq!(doc.page_count(), 1);
    doc.ensure(100_000.0);
    assert_eq!((doc.page_count(), doc.y), (2, TOP));
    assert!(doc.remaining() > 600.0 && doc.remaining() < doc.limit());
}

#[test]
fn primitives_use_top_down_coordinates() {
    let mut doc = Doc::new(chrome());
    doc.cur.clear();
    doc.rect(10.0, 20.0, 30.0, 40.0, OK);
    let bottom = PAGE_H - 60.0;
    assert!(doc
        .cur
        .contains(&format!("10.00 {bottom:.2} 30.00 40.00 re f")));
    doc.frame(1.0, 2.0, 3.0, 4.0, OK);
    assert!(doc.cur.contains("re S"));
    doc.hline(5.0, 50.0, 100.0, OK, 0.5);
    assert!(doc.cur.contains("0.50 w\n5.00 741.89 m 50.00 741.89 l S"));
}

#[test]
fn bold_text_is_faked_with_stroke_and_widens_measurement() {
    let mut doc = Doc::new(chrome());
    doc.cur.clear();
    doc.text(10.0, 50.0, Style::BODY, "plain");
    assert!(!doc.cur.contains("2 Tr"));
    doc.text(10.0, 50.0, Style::BODY.bold(), "bold");
    assert!(doc.cur.contains("2 Tr") && doc.cur.contains("0 Tr"));
    let plain = doc.text_width("Widths", Style::BODY);
    assert!(doc.text_width("Widths", Style::BODY.bold()) > plain);
    assert_eq!(Style::BODY.colored(OK).color, OK);
    assert!((Style::new(10.0, OK, false).leading() - 14.0).abs() < 0.01);
}

#[test]
fn aligned_text_and_fitted_lines() {
    let mut doc = Doc::new(chrome());
    let style = Style::BODY;
    doc.cur.clear();
    doc.text_right(200.0, 50.0, style, "right");
    let x = 200.0 - doc.text_width("right", style);
    assert!(doc.cur.contains(&format!("{x:.2} {:.2} Td", PAGE_H - 50.0)));
    doc.cur.clear();
    doc.text_center(100.0, 50.0, style, "mid");
    let x = 100.0 - doc.text_width("mid", style) / 2.0;
    assert!(doc.cur.contains(&format!("{x:.2} ")));
    assert_eq!(doc.fit_line("short", 200.0, style), "short");
    let fitted = doc.fit_line(&"long ".repeat(40), 100.0, style);
    assert!(fitted.ends_with('\u{2026}') && doc.text_width(&fitted, style) <= 100.0);
}

#[test]
fn blank_text_becomes_a_dash_and_paragraphs_paginate() {
    assert_eq!(dash("  \n"), EMPTY);
    assert_eq!(dash(" x "), "x");
    let doc = Doc::new(chrome());
    assert_eq!(doc.wrap("", 100.0, Style::BODY), vec![EMPTY]);
    let mut doc = Doc::new(chrome());
    let words = (0..900).map(|n| format!("word{n}")).collect::<Vec<_>>();
    doc.paragraph(40.0, 300.0, Style::BODY, &words.join(" "));
    assert!(doc.page_count() > 1);
    assert!(pdf_has_text(&doc.finish(), "word899"));
}

#[test]
fn multilingual_text_keeps_its_logical_content() {
    let mut doc = Doc::new(chrome());
    doc.paragraph(40.0, 400.0, Style::BODY, "Zażółć Привет 你好 مرحبا");
    let text = extract_pdf_text(&doc.finish());
    for part in ["Zażółć", "Привет", "你好", "مرحبا"] {
        assert!(text.contains(part), "missing {part}");
    }
}
