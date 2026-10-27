use super::cover::duration;
use super::data::{flag, joined, list, num, page_url, Crawl};
use super::metrics::{
    compute, duplicate_groups, indexability, is_broken, orphans, status_class, Idx,
};
use serde_json::json;

#[test]
fn data_helpers_read_values_defensively() {
    let run = json!({"result": {"pages": [{"url": "u", "final_url": "f"}], "x": true, "n": 2, "list": [1]}});
    let c = Crawl::new(&run);
    assert_eq!(c.pages.len(), 1);
    assert!(c.rflag("x") && !c.rflag("missing"));
    assert_eq!(
        (c.rnum("n"), c.r("n").as_deref(), c.rlist("list").len()),
        (Some(2.0), Some("2"), 1)
    );
    let empty = json!({});
    assert!(Crawl::new(&empty).pages.is_empty());
    let page = json!({"url": "u", "a": ["x", "y"], "f": true});
    assert_eq!(
        (page_url(&page), joined(&page, "a", "+")),
        ("u".into(), Some("x+y".into()))
    );
    assert_eq!(
        (
            joined(&page, "none", "+"),
            flag(&page, "f"),
            num(&page, "none")
        ),
        (None, true, None)
    );
    assert!(list(&page, "none").is_empty());
}

#[test]
fn durations_switch_units() {
    assert_eq!(duration(None), "\u{2014}");
    assert_eq!(duration(Some(17_629.0)), "17.6 s");
    assert_eq!(duration(Some(125_000.0)), "2 min 5 s");
}

#[test]
fn indexability_status_classes_and_broken_links() {
    let case = |value| indexability(&value);
    assert_eq!(
        case(json!({"indexability_verdict": {"status": "indexable"}})),
        Idx::Yes
    );
    assert_eq!(
        case(json!({"indexability_verdict": {"status": "blocked"}})),
        Idx::No
    );
    assert_eq!(
        case(json!({"indexability_verdict": {"status": "uncertain"}})),
        Idx::Maybe
    );
    assert_eq!(
        case(json!({"indexability_status": "Eligible from this response only"})),
        Idx::Yes
    );
    assert_eq!(
        case(json!({"indexability_status": "Blocked by HTTP error"})),
        Idx::No
    );
    assert_eq!(
        case(json!({"indexability_status": "Not indexable"})),
        Idx::No
    );
    assert_eq!(case(json!({})), Idx::Maybe);
    assert_eq!(status_class(&json!({"http_status": 404})), 4);
    assert_eq!(status_class(&json!({"http_status": 0})), 0);
    assert!(is_broken(&json!({"target_http_status": 500})));
    assert!(is_broken(&json!({"target_request_error_kind": "timeout"})));
    assert!(!is_broken(&json!({"target_http_status": 200})));
}

fn graph() -> Vec<serde_json::Value> {
    vec![
        json!({"url": "a", "depth": 0, "title": "T", "links": [{"target_url": "b", "is_internal": true}, {"target_url": "x", "is_internal": false, "target_http_status": 404}]}),
        json!({"url": "b", "final_url": "b2", "depth": 1, "title": "T", "links": [{"target_url": "b", "is_internal": true, "target_http_status": 410}]}),
        json!({"url": "c", "depth": 2, "links": []}),
    ]
}

#[test]
fn orphans_duplicates_and_metrics_come_from_the_page_graph() {
    let pages = graph();
    assert_eq!(orphans(&pages), vec![2]);
    assert_eq!(
        duplicate_groups(&pages, "title"),
        vec![("T".to_owned(), vec![0, 1])]
    );
    let m = compute(&pages);
    assert_eq!(
        (m.orphans, m.dup_groups, m.broken, m.missing[0]),
        (1, 1, [1, 1], 1)
    );
    assert_eq!(m.counts, [0, 0, 3]);
    assert_eq!(m.classes[4], 3);
    assert_eq!((m.avg_ms, m.avg_words), (None, None));
}
