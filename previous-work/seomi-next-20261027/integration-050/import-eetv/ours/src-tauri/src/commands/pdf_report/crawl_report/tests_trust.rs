use super::fixture::synthetic;
use super::focus_text::coded;
use super::sec_trust::{kpis, level_color, present};
use super::strings::trust::{self as k, ALL, FINDINGS, KINDS, LEVELS, SEVERITIES, YMYLS};
use super::tests::text_of;
use crate::commands::pdf_report::labels::default_keys;
use serde_json::{json, Value};
use std::collections::HashSet;

fn trust() -> Value {
    json!({
        "score": 58, "level": "weak", "ymyl": "health", "ymyl_unattributed_pct": 40,
        "article_count": 20, "page_count": 30,
        "layers": {"schema_graph": 70, "author_alignment": null, "citation_quality": 30, "transparency": 45},
        "organization": {"present": true, "has_id": true, "same_as": 0},
        "counts": {"authors": 3, "authors_with_same_as": 1, "trusted_pages": 4, "analyzed_pages": 20, "dead_links": 2, "dated_articles": 5},
        "authors": [
            {"name": "Anna Nowak", "articles": 12, "same_as": 1, "alignment": 88, "generic": false},
            {"name": "Redakcja", "articles": 8, "same_as": 0, "alignment": null, "generic": true}],
        "pages": {"editorial": null, "about": "https://s.test/about", "contact": null, "registry": null},
        "findings": [
            {"code": "ymyl-unattributed", "params": {"count": 8, "pct": 40}, "severity": "critical"},
            {"code": "author-no-same-as", "params": {"count": 2, "names": "Anna, Jan"}, "severity": "warning"},
            {"code": "mystery-code", "params": {}, "severity": "info"}]
    })
}

fn with_trust(trust: Value) -> Value {
    let mut run = synthetic(12);
    run["trust"] = trust;
    run
}

#[test]
fn every_static_trust_label_key_exists_in_english() {
    let known: HashSet<&str> = default_keys().into_iter().collect();
    ALL.iter()
        .for_each(|key| assert!(known.contains(key), "missing: {key}"));
    let groups = [
        (k::LEVEL, LEVELS),
        (k::SEVERITY, SEVERITIES),
        (k::KIND, KINDS),
        (k::YMYL, YMYLS),
    ];
    for (prefix, codes) in groups {
        for code in codes {
            let key = format!("{prefix}.{code}");
            assert!(known.contains(key.as_str()), "missing: {key}");
        }
    }
    for (code, _) in FINDINGS {
        let key = format!("{}.{code}", k::FIND);
        assert!(known.contains(key.as_str()), "missing: {key}");
    }
}

#[test]
fn trust_section_shows_score_layers_findings_authors_and_pages() {
    let text = text_of(&with_trust(trust()));
    for part in [
        "Entity Trust (E-E-A-T)",
        "Entity Trust Score",
        "Weak trust",
        "Entity graph",
        "No data in this crawl",
        "Source quality",
        "Author entities",
        "YMYL category: health. 40% of articles",
        "Trust findings",
        "8 articles (40%) on a YMYL topic",
        "2 authors have no sameAs links (Anna, Jan)",
        "mystery-code",
        "Anna Nowak",
        "Redakcja (anonymous byline)",
        "Trust pages",
        "Found: https://s.test/about",
        "Missing",
    ] {
        assert!(text.contains(part), "missing: {part}");
    }
}

#[test]
fn trust_section_is_omitted_without_a_summary_or_when_the_template_excludes_it() {
    assert!(!text_of(&synthetic(12)).contains("Entity Trust Score"));
    let mut run = with_trust(trust());
    run["report_template_sections"] = json!(["summary", "focus"]);
    assert!(!present(&run));
    assert!(!text_of(&run).contains("Entity Trust Score"));
    run["report_template_sections"] = json!(["summary", "trust"]);
    assert!(present(&run));
    assert!(!present(&with_trust(json!("nope"))));
}

#[test]
fn section_without_ymyl_authors_or_layers_still_renders() {
    let bare = json!({"score": 10, "level": "critical", "layers": {}, "findings": [], "authors": [], "pages": {}});
    let text = text_of(&with_trust(bare));
    assert!(text.contains("Critical trust gaps"));
    assert!(!text.contains("YMYL category"));
    assert!(!text.contains("Author entities\n"));
}

#[test]
fn level_colours_and_kpis_cover_every_layer() {
    let colors: Vec<_> = LEVELS.iter().map(|level| level_color(level)).collect();
    assert!(colors
        .iter()
        .enumerate()
        .all(|(i, c)| colors.iter().skip(i + 1).all(|o| c != o)));
    assert_eq!(level_color("other"), level_color("none"));
    let items = kpis(&trust());
    assert_eq!(items.len(), 6);
    assert_eq!(items[0].value, "70");
    assert_eq!(items[1].value, "\u{2014}");
    assert_eq!(items[4].value, "20");
    assert_eq!(items[5].note, "1 with sameAs");
    assert_eq!(coded(k::LEVEL, "strong", &[]), "Strong trust");
}
