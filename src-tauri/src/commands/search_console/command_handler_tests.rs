use super::*;
use models::GscPerformanceFilters;

const VALID_CLIENT: &str = "123456789-abcdef.apps.googleusercontent.com";
const VALID_PROJ: &str = "proj-coverage-test";

#[tokio::test]
async fn connect_and_disconnect_command_handlers_validate_input() {
    assert!(connect_search_console("".into(), VALID_CLIENT.into(), None)
        .await
        .is_err());
    assert!(
        connect_search_console("bad/proj".into(), VALID_CLIENT.into(), None)
            .await
            .is_err()
    );
    assert!(
        connect_search_console(VALID_PROJ.into(), "bad-client".into(), None)
            .await
            .is_err()
    );

    assert!(disconnect_search_console("".into()).await.is_err());
    assert!(disconnect_search_console("invalid proj id".into())
        .await
        .is_err());

    let res = disconnect_search_console(VALID_PROJ.into()).await;
    assert!(
        res.is_ok(),
        "disconnecting non-existent token should succeed cleanly"
    );
}

#[tokio::test]
async fn list_properties_command_handler_validates_and_checks_store() {
    assert!(
        list_search_console_properties("".into(), VALID_CLIENT.into())
            .await
            .is_err()
    );
    assert!(
        list_search_console_properties(VALID_PROJ.into(), "bad-client".into())
            .await
            .is_err()
    );

    let res = list_search_console_properties(VALID_PROJ.into(), VALID_CLIENT.into()).await;
    let err = res.err().expect("must fail without credentials");
    assert!(err.contains("Search Console refresh token") || err.contains("credential store"));
}

#[tokio::test]
async fn performance_command_handler_validates_all_parameters() {
    assert!(search_console_performance(
        VALID_PROJ.into(),
        VALID_CLIENT.into(),
        "   ".into(),
        None,
        None,
        None,
    )
    .await
    .is_err());

    let missing_dates = search_console_performance(
        VALID_PROJ.into(),
        VALID_CLIENT.into(),
        "sc-domain:example.test".into(),
        Some("2026-01-01".into()),
        None,
        None,
    )
    .await;
    assert_eq!(
        missing_dates.unwrap_err(),
        "Podaj obie daty zakresu Search Console."
    );

    let bad_date = search_console_performance(
        VALID_PROJ.into(),
        VALID_CLIENT.into(),
        "sc-domain:example.test".into(),
        Some("not-a-date".into()),
        Some("2026-01-02".into()),
        None,
    )
    .await;
    assert_eq!(
        bad_date.unwrap_err(),
        "Start date must be a valid YYYY-MM-DD date."
    );

    let bad_filter = search_console_performance(
        VALID_PROJ.into(),
        VALID_CLIENT.into(),
        "sc-domain:example.test".into(),
        Some("2026-01-01".into()),
        Some("2026-01-02".into()),
        Some(GscPerformanceFilters {
            search_type: Some("invalid_search_type".into()),
            ..Default::default()
        }),
    )
    .await;
    assert_eq!(
        bad_filter.unwrap_err(),
        "Invalid Search Console search type."
    );

    let res = search_console_performance(
        VALID_PROJ.into(),
        VALID_CLIENT.into(),
        "sc-domain:example.test".into(),
        Some("2026-01-01".into()),
        Some("2026-01-02".into()),
        None,
    )
    .await;
    assert!(res.is_err());
}

#[path = "inspection_handler_tests.rs"]
mod inspection;
