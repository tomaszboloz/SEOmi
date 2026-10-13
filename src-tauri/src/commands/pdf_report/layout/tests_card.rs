use super::card::{Card, CardRow};
use super::color::CRITICAL;
use super::doc::Doc;
use super::tests_doc::chrome;
use crate::commands::pdf_report::tests::extract_pdf_text;

fn card(items: Vec<String>) -> Card {
    Card {
        accent: CRITICAL,
        badge: "BADGEX".into(),
        meta: "Category".into(),
        tag: "code_tag".into(),
        headline: "Headline text".into(),
        rows: vec![
            CardRow {
                label: "WHERE".into(),
                items,
            },
            CardRow {
                label: "HOW".into(),
                items: vec!["Fix it".into()],
            },
        ],
    }
}

fn many(count: usize) -> Vec<String> {
    (0..count).map(|n| format!("item-{n}")).collect()
}

#[test]
fn a_small_card_stays_on_the_page_and_moves_the_cursor() {
    let mut doc = Doc::new(chrome());
    let start = doc.y;
    doc.card(&card(vec!["single".into()]));
    assert_eq!(doc.page_count(), 1);
    assert!(doc.y > start + 60.0);
    let text = extract_pdf_text(&doc.finish());
    for part in [
        "BADGEX",
        "Category",
        "code_tag",
        "Headline text",
        "single",
        "Fix it",
    ] {
        assert!(text.contains(part), "missing {part}");
    }
    assert!(!text.contains('\u{2022}'));
}

#[test]
fn several_items_become_a_bullet_list() {
    let mut doc = Doc::new(chrome());
    doc.card(&card(many(3)));
    let text = extract_pdf_text(&doc.finish());
    assert_eq!(text.matches('\u{2022}').count(), 3);
}

#[test]
fn a_card_that_fits_on_the_next_page_is_not_split() {
    let mut doc = Doc::new(chrome());
    doc.skip(640.0);
    doc.card(&card(many(12)));
    assert_eq!(doc.page_count(), 2);
    let text = extract_pdf_text(&doc.finish());
    assert_eq!(text.matches("BADGEX").count(), 1);
    assert!(text.contains("item-11"));
}

#[test]
fn a_card_taller_than_a_page_is_split_and_repeats_its_badge() {
    let mut doc = Doc::new(chrome());
    doc.card(&card(many(200)));
    let pages = doc.page_count();
    assert!(pages >= 3);
    let text = extract_pdf_text(&doc.finish());
    assert_eq!(text.matches("BADGEX").count(), pages);
    assert!(text.contains("item-0") && text.contains("item-199"));
    assert_eq!(text.matches("Fix it").count(), 1);
}

#[test]
fn long_headlines_wrap_inside_the_card() {
    let mut doc = Doc::new(chrome());
    let mut long = card(vec!["x".into()]);
    long.headline = "headlinew ".repeat(30);
    let before = doc.y;
    doc.card(&long);
    assert!(doc.y - before > 100.0);
    let text = extract_pdf_text(&doc.finish());
    assert_eq!(text.matches("headlinew").count(), 30);
}
