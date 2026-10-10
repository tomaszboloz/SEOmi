use super::{page, result_for_pages, CrawledPageIssue, SiteCrawlResult};

#[test]
fn current_formula_has_stable_fixture_scores_and_version() {
    for (severity, expected) in [("Info", 100), ("Warning", 90), ("Critical", 80)] {
        let mut sample = page("https://fixture.test/");
        sample.issues.push(CrawledPageIssue {
            severity: severity.into(),
            message: "Missing title".into(),
        });
        let result = result_for_pages(vec![sample]);
        assert_eq!(result.health_score, expected, "{severity}");
        assert_eq!(result.score_version, 2);
        let value = serde_json::to_value(&result).unwrap();
        assert_eq!(value["score_version"], 2);
    }
}

#[test]
fn legacy_snapshots_keep_unknown_version_instead_of_being_relabelled() {
    let result = result_for_pages(vec![page("https://fixture.test/")]);
    let mut value = serde_json::to_value(&result).unwrap();
    value.as_object_mut().unwrap().remove("score_version");
    let legacy: SiteCrawlResult = serde_json::from_value(value).unwrap();
    assert_eq!(legacy.score_version, 0);
    assert_eq!(legacy.health_score, result.health_score);
    let restored: SiteCrawlResult =
        serde_json::from_value(serde_json::to_value(result).unwrap()).unwrap();
    assert_eq!(restored.score_version, 2);
}
