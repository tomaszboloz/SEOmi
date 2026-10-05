use super::*;
use crate::utils::file_lock::acquire_file_lock;

#[test]
fn conditional_publication_requires_exact_state_and_generation_without_running_obsolete_actions() {
    let fixture = Fixture::new();
    let app = fixture.handle();
    save_project_audit_queue(app.clone(), "one".into(), json!({"items":[],"run":null})).unwrap();
    let state = read_queue_state(&app, "one").unwrap();
    let expected = state.snapshot.unwrap();
    let generation = state.generation.unwrap();
    assert!(
        !update_queue_if_current(&app, "one", (&json!({}), Some(&generation)), || panic!(
            "obsolete action"
        ))
        .unwrap()
    );
    assert!(
        !update_queue_if_current(&app, "one", (&expected, Some("obsolete")), || panic!(
            "obsolete action"
        ))
        .unwrap()
    );
    assert!(
        update_queue_if_current(&app, "one", (&expected, Some(&generation)), || {
            assert!(
                acquire_file_lock(&fixture.project("one").join("audit_queue_mutation.lock"))
                    .unwrap()
                    .is_none()
            );
            write_queue_result(&app, "one", "run", "item", &json!({"owned":true}))?;
            Ok(json!({"accepted":true}))
        })
        .unwrap()
    );
    assert_eq!(
        load_project_audit_queue(app.clone(), "one".into()).unwrap(),
        json!({"accepted":true})
    );
    assert_eq!(
        read_queue_state(&app, "one").unwrap().generation.as_deref(),
        Some(generation.as_str())
    );
    assert_eq!(
        list_project_audit_queue_results(app, "one".into()).unwrap(),
        vec![json!({"owned":true})]
    );
}

#[test]
fn identical_save_or_delete_and_restore_invalidates_an_old_generation() {
    let fixture = Fixture::new();
    let app = fixture.handle();
    let snapshot = json!({"items":[],"run":null});
    save_project_audit_queue(app.clone(), "one".into(), snapshot.clone()).unwrap();
    let first = read_queue_state(&app, "one").unwrap();
    save_project_audit_queue(app.clone(), "one".into(), snapshot.clone()).unwrap();
    let second = read_queue_state(&app, "one").unwrap();
    assert_eq!(first.snapshot, second.snapshot);
    assert_ne!(first.generation, second.generation);
    assert!(!update_queue_if_current(
        &app,
        "one",
        (&snapshot, first.generation.as_deref()),
        || panic!("old generation")
    )
    .unwrap());
    delete_project_audit_queue(app.clone(), "one".into()).unwrap();
    let deleted = read_queue_state(&app, "one").unwrap();
    assert_eq!(deleted.snapshot, None);
    assert_ne!(deleted.generation, second.generation);
    save_project_audit_queue(app.clone(), "one".into(), snapshot.clone()).unwrap();
    assert!(!update_queue_if_current(
        &app,
        "one",
        (&snapshot, second.generation.as_deref()),
        || panic!("restored obsolete generation")
    )
    .unwrap());
    assert!(fixture
        .project("one")
        .join("audit_queue_mutation.lock")
        .exists());
}

#[test]
fn failed_or_invalid_mutations_keep_snapshot_and_do_not_publish_an_execution() {
    let fixture = Fixture::new();
    let app = fixture.handle();
    let snapshot = json!({"items":[],"run":null});
    save_project_audit_queue(app.clone(), "one".into(), snapshot.clone()).unwrap();
    let before = read_queue_state(&app, "one").unwrap();
    assert!(save_project_audit_queue(app.clone(), "one".into(), json!([])).is_err());
    assert_eq!(
        read_queue_state(&app, "one").unwrap().generation,
        before.generation
    );
    assert_eq!(
        update_queue_if_current(
            &app,
            "one",
            (&snapshot, before.generation.as_deref()),
            || Err("controlled failure".into())
        )
        .unwrap_err(),
        "controlled failure"
    );
    assert_eq!(
        load_project_audit_queue(app.clone(), "one".into()).unwrap(),
        snapshot
    );
    assert!(list_project_audit_queue_executions(app, "one".into())
        .unwrap()
        .is_empty());
}

#[test]
fn legacy_generation_and_generation_storage_errors_are_explicit() {
    let fixture = Fixture::new();
    let app = fixture.handle();
    let project = fixture.project("one");
    fs::create_dir_all(&project).unwrap();
    fs::write(project.join("audit_queue.json"), b"{}").unwrap();
    let legacy = read_queue_state(&app, "one").unwrap();
    assert_eq!(legacy.generation, None);
    assert!(
        update_queue_if_current(&app, "one", (&json!({}), None), || Ok(
            json!({"legacy":true})
        ))
        .unwrap()
    );
    let path = project.join("audit_queue_generation");
    fs::write(&path, [255]).unwrap();
    assert!(read_queue_state(&app, "one")
        .err()
        .unwrap()
        .contains("generation is invalid"));
    fs::remove_file(&path).unwrap();
    fs::create_dir(&path).unwrap();
    assert!(read_queue_state(&app, "one")
        .err()
        .unwrap()
        .contains("Unable to read audit queue generation"));
    assert!(save_project_audit_queue(app, "one".into(), json!({}))
        .unwrap_err()
        .contains("Unable to persist audit queue generation"));
}
