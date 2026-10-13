use crate::commands::site_crawler::prefetch::record_task_failure;
use std::collections::{HashMap, VecDeque};

#[test]
fn a_lost_prefetch_task_fails_the_first_page_without_a_result() {
    let order: VecDeque<_> = [
        ("https://a.test/".to_string(), 0),
        ("https://b.test/".into(), 1),
    ]
    .into();
    let mut responses = HashMap::new();
    record_task_failure(&order, &mut responses, "task cancelled".into());
    assert!(matches!(
        responses.get("https://a.test/"),
        Some(Err(failure)) if failure.kind == "prefetch_task" && failure.message == "task cancelled"
    ));
    record_task_failure(&order, &mut responses, "second".into());
    assert!(responses.contains_key("https://b.test/"));
    record_task_failure(&order, &mut responses, "third".into());
    assert_eq!(responses.len(), 2);
}
