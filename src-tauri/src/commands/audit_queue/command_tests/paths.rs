use super::super::paths::*;
use super::*;

#[test]
fn project_and_handoff_paths_assert_identifiers_and_exact_ownership() {
    let fixture = Fixture::new();
    let app = fixture.handle();
    let valid = "a".repeat(80);
    assert_eq!(
        crawl_storage::project_directory(&app, &valid).unwrap(),
        fixture.root.join("projects").join(&valid)
    );
    assert_eq!(
        queue_path(&app, "one").unwrap(),
        fixture.project("one").join("audit_queue.json")
    );
    assert_eq!(
        queue_execution_path(&app, "one", &valid).unwrap(),
        fixture
            .project("one")
            .join(format!("audit_queue_execution_{valid}.json"))
    );
    assert_eq!(
        queue_result_path(&app, "one", "run", "item").unwrap(),
        fixture
            .project("one")
            .join("audit_queue_result_run_item.json")
    );
    for invalid in ["", "a/b", "żółć", "a b", &"a".repeat(81)] {
        assert!(crawl_storage::project_directory(&app, invalid)
            .unwrap_err()
            .contains("Invalid project"));
        assert!(queue_execution_path(&app, "one", invalid)
            .unwrap_err()
            .contains("Invalid audit queue run"));
        assert!(queue_result_path(&app, "one", invalid, "item")
            .unwrap_err()
            .contains("Invalid audit queue result"));
        assert!(queue_result_path(&app, "one", "run", invalid)
            .unwrap_err()
            .contains("Invalid audit queue result"));
    }
}
