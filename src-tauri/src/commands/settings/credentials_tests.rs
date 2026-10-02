use super::{
    credentials::{credentials_with, dataforseo_credentials},
    fixture::MemoryStore,
};

#[test]
fn credentials_are_read_from_the_requested_project_and_exact_values_are_preserved() {
    let store = MemoryStore::default();
    for project in ["p-1", "p-2"] {
        store.seed(&format!("dataforseo_login_{project}"), project);
        store.seed(
            &format!("dataforseo_password_{project}"),
            " synthetic-password ",
        );
        assert_eq!(
            credentials_with(project, &store).unwrap(),
            (project.into(), " synthetic-password ".into())
        );
    }
    assert_eq!(
        *store.calls.borrow(),
        [
            "read:dataforseo_login_p-1",
            "read:dataforseo_password_p-1",
            "read:dataforseo_login_p-2",
            "read:dataforseo_password_p-2"
        ]
    );
}

#[test]
fn invalid_project_never_reads_credentials() {
    let store = MemoryStore::default();
    for project in ["", "p/../other", "p_other", " p", &"x".repeat(81)] {
        assert!(credentials_with(project, &store).is_err());
        assert!(dataforseo_credentials(project).is_err());
    }
    assert!(store.calls.borrow().is_empty());
}

#[test]
fn missing_unavailable_and_incomplete_credentials_do_not_produce_success() {
    let store = MemoryStore::default();
    assert!(credentials_with("p", &store).unwrap_err().contains("login"));
    store.seed("dataforseo_login_p", "synthetic-login");
    assert!(credentials_with("p", &store)
        .unwrap_err()
        .contains("password"));
    store.seed("dataforseo_password_p", "");
    assert!(credentials_with("p", &store)
        .unwrap_err()
        .contains("incomplete"));
    store.seed("dataforseo_password_p", "synthetic-password");
    store.seed("dataforseo_login_p", " \t");
    assert!(credentials_with("p", &store)
        .unwrap_err()
        .contains("incomplete"));
    let failed = MemoryStore {
        failed: true,
        ..Default::default()
    };
    assert!(credentials_with("p", &failed)
        .unwrap_err()
        .contains("login"));
}
