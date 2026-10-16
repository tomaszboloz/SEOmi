use super::check::yes_no;
use super::ctx::{format_number, pretty_time};
use super::fixture::fixture;
use super::model::{category_label, findings, Sev};
use super::strings::tf;
use crate::commands::pdf_report::layout::color::{CRITICAL, MUTED, OK, WARNING};
use crate::commands::pdf_report::layout::widgets::score_color;
use serde_json::json;

#[test]
fn severities_parse_sort_and_carry_colours() {
    assert_eq!(Sev::parse("Critical"), Sev::Critical);
    assert_eq!(Sev::parse("error"), Sev::Critical);
    assert_eq!(Sev::parse("WARNING"), Sev::Warning);
    assert_eq!(Sev::parse("whatever"), Sev::Info);
    assert!(Sev::Critical < Sev::Warning && Sev::Warning < Sev::Info);
    assert_eq!(Sev::Critical.color(), CRITICAL);
    assert_eq!(Sev::Info.label(), "Info");
    assert_eq!(Sev::Warning.label(), "Warning");
}

#[test]
fn findings_are_sorted_and_always_complete() {
    let audit = fixture();
    let list = findings(&audit);
    let order: Vec<_> = list.iter().map(|f| (f.sev, f.category.as_str())).collect();
    assert_eq!(
        order,
        [
            (Sev::Critical, "Meta tags"),
            (Sev::Warning, "Security"),
            (Sev::Warning, "Technical"),
            (Sev::Info, "Images")
        ]
    );
    let odd = &list[2];
    assert_eq!(odd.code, "");
    assert!(odd.recommendation.contains("Review this finding"));
    assert!(odd.location[0].starts_with("Whole page"));
    let blank = findings(&json!({"issues": [{}]}));
    assert_eq!(
        blank[0].message,
        "No description was provided for this finding."
    );
    assert_eq!(blank[0].category, "General");
    assert!(findings(&json!({})).is_empty());
}

#[test]
fn category_identifiers_become_readable_labels() {
    assert_eq!(category_label("MetaTags"), "Meta tags");
    assert_eq!(category_label("StructuredData"), "Structured data");
    assert_eq!(category_label("Links"), "Links");
    assert_eq!(category_label(""), "General");
}

#[test]
fn helpers_format_numbers_times_and_flags() {
    assert_eq!(format_number(3.0), "3");
    assert_eq!(format_number(10.44), "10.4");
    assert_eq!(
        pretty_time("2026-10-13T17:30:39.2Z"),
        "2026-10-13 17:30 UTC"
    );
    assert_eq!(pretty_time("yesterday"), "yesterday");
    assert_eq!(pretty_time("2026-10-13 17:30:39Z"), "2026-10-13 17:30:39Z");
    assert_eq!(tf("{{0}}-{{1}}", &["a", "b"]), "a-b");
    assert_eq!(yes_no(Some(true)).as_deref(), Some("Yes"));
    assert_eq!(yes_no(Some(false)).as_deref(), Some("No"));
    assert_eq!(yes_no(None), None);
}

#[test]
fn score_colours_follow_the_thresholds() {
    assert_eq!(score_color(Some(80.0)), OK);
    assert_eq!(score_color(Some(79.0)), WARNING);
    assert_eq!(score_color(Some(50.0)), WARNING);
    assert_eq!(score_color(Some(49.0)), CRITICAL);
    assert_eq!(score_color(None), MUTED);
}
