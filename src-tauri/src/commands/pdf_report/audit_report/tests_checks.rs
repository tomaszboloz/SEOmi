use super::check::{Check, Status};
use super::ctx::Ctx;
use super::fixture::fixture;
use super::kpi::kpis;
use super::model::findings;
use super::sections::build;
use crate::commands::pdf_report::layout::color::{CRITICAL, MUTED, OK, WARNING};
use serde_json::json;

fn ctx_of(audit: &serde_json::Value) -> Ctx<'_> {
    Ctx {
        audit,
        findings: findings(audit),
    }
}

#[test]
fn checks_derive_their_status_from_findings_and_values() {
    let audit = fixture();
    let ctx = ctx_of(&audit);
    let missing = ctx.judged("Description", None, &["meta_description"]);
    assert_eq!(
        (missing.status, missing.advice.as_str()),
        (Status::Attention, "Add a description")
    );
    assert_eq!(
        ctx.judged("Viewport", Some("x".into()), &["meta_viewport"])
            .status,
        Status::Ok
    );
    let unset = ctx.judged("Robots", None, &["meta_robots"]);
    assert_eq!(
        (unset.status, unset.value.as_str()),
        (Status::Info, "\u{2014}")
    );
    assert_eq!(Check::required("a", None, "fix").status, Status::Attention);
    assert_eq!(
        Check::required("a", Some("v".into()), "fix").status,
        Status::Ok
    );
    let counted = ctx.counted("Images", "2 found".into(), 2, &["nothing"], "fallback");
    assert_eq!(
        (counted.status, counted.advice.as_str()),
        (Status::Attention, "fallback")
    );
    assert_eq!(
        ctx.counted("Images", "0".into(), 0, &["nothing"], "f")
            .status,
        Status::Ok
    );
    assert_eq!(
        ctx.counted("Alt", "1".into(), 1, &["images_alt"], "f")
            .advice,
        "Add alt text"
    );
    assert_eq!(Status::Ok.label(), "OK");
    assert_eq!(Status::Attention.label(), "Needs attention");
    assert_eq!(Status::Info.color(), MUTED);
}

#[test]
fn sections_exist_only_for_audit_areas_present_in_the_data() {
    let audit = fixture();
    let ctx = ctx_of(&audit);
    let titles: Vec<_> = build(&ctx).into_iter().map(|s| s.title).collect();
    assert_eq!(titles.len(), 14, "{titles:?}");
    assert!(!titles.contains(&"Content statistics".to_owned()));
    let minimal = json!({"final_url": "u", "meta_tags": null});
    assert!(build(&ctx_of(&minimal)).is_empty());
}

#[test]
fn indexability_cookie_and_structured_checks_flag_problems() {
    let audit = fixture();
    let ctx = ctx_of(&audit);
    let sections = build(&ctx);
    let find = |title: &str, name: &str| {
        let section = sections.iter().find(|s| s.title == title).unwrap();
        section
            .checks
            .iter()
            .find(|c| c.name == name)
            .unwrap()
            .clone()
    };
    let index = find("Indexability", "Indexability status");
    assert_eq!(
        (index.status, index.advice.as_str()),
        (Status::Attention, "No canonical.")
    );
    assert_eq!(
        find("Transport security", "Cookie: sid").status,
        Status::Attention
    );
    assert_eq!(
        find("Structured data", "Article (JSON-LD)").advice,
        "Add headline"
    );
    assert_eq!(
        find("Headings", "Valid heading hierarchy").status,
        Status::Attention
    );
    assert_eq!(find("Redirect chain", "Hop 1").status, Status::Info);
    assert_eq!(
        find("Open Graph and Twitter card", "og:description").advice,
        "Add the og:description tag to the page head."
    );
}

#[test]
fn kpi_cards_always_carry_a_value_and_semantic_colour() {
    let audit = fixture();
    let cards = kpis(&ctx_of(&audit));
    assert_eq!(cards.len(), 8);
    let by = |label: &str| cards.iter().find(|c| c.label == label).unwrap();
    assert_eq!(
        (
            by("RESPONSE TIME").value.as_str(),
            by("RESPONSE TIME").color
        ),
        ("1200 ms", WARNING)
    );
    assert_eq!(
        (
            by("META DESCRIPTION").value.as_str(),
            by("META DESCRIPTION").color
        ),
        ("Missing", CRITICAL)
    );
    assert_eq!(by("H1 HEADINGS").color, WARNING);
    assert_eq!(by("IMAGES").note, "1 without alt text");
    assert_eq!(by("HTTP STATUS").color, OK);
    let redirect = json!({"final_url": "u", "http_status": 302});
    assert_eq!(kpis(&ctx_of(&redirect))[0].color, WARNING);
    let broken = json!({"final_url": "u", "http_status": 503});
    assert_eq!(kpis(&ctx_of(&broken))[0].color, CRITICAL);
    let empty = json!({"final_url": "u"});
    assert!(kpis(&ctx_of(&empty))
        .iter()
        .all(|c| c.color == MUTED || c.label == "META DESCRIPTION"));
}
