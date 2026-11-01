use super::super::session_test_modules::{Server, Store};
use super::*;

const CLIENT: &str = "fixture.apps.googleusercontent.com";
const TOKEN: (&str, &str) = ("200 OK", r#"{"access_token":"fixture-access"}"#);

fn ids(site: &str, page: &str) -> (String, String, String, String) {
    ("p".into(), CLIENT.into(), site.into(), page.into())
}
fn range() -> (Option<String>, Option<String>) {
    (Some("2026-01-01".into()), Some("2026-01-03".into()))
}
fn store() -> Store {
    Store::with_values(&[("gsc_refresh_token_p", "refresh")])
}

#[test]
fn only_pages_inside_the_property_are_queried() {
    for (site, page) in [
        ("https://a.test/", "https://a.test/x?y=1"),
        ("sc-domain:a.test", "https://blog.a.test/x"),
        ("sc-domain:A.test", "https://a.test/"),
    ] {
        assert!(page_in_property(site, page).is_ok(), "{page}");
    }
    for (site, page) in [
        ("https://a.test/", "https://b.test/x"),
        ("sc-domain:a.test", "https://nota.test/x"),
        ("https://a.test/", "ftp://a.test/x"),
        ("https://a.test/", "https://u:p@a.test/x"),
        ("https://a.test/", "not a url"),
    ] {
        assert!(page_in_property(site, page).is_err(), "{page}");
    }
}

#[test]
fn the_request_filters_one_page_and_groups_by_date() {
    let body = payload("2026-01-01", "2026-01-03", "https://a.test/x");
    assert_eq!(body["dimensions"][0], "date");
    assert_eq!(
        body["dimensionFilterGroups"][0]["filters"][0]["expression"],
        "https://a.test/x"
    );
    assert_eq!(body["rowLimit"], ROW_LIMIT);
}

#[tokio::test]
async fn returns_daily_rows_and_flags_a_full_page_as_possibly_truncated() {
    let rows = r#"{"rows":[{"keys":["2026-01-01"],"clicks":3,"impressions":40,"ctr":0.07,"position":4.2}]}"#;
    let server = Server::new(&[TOKEN, ("200 OK", rows)]).await;
    let result = page_daily_with(
        ids("https://a.test/", "https://a.test/x"),
        range(),
        &store(),
        (&server.endpoint, Some(&server.endpoint)),
    )
    .await
    .unwrap();
    assert_eq!(result["rows"][0]["clicks"], 3);
    assert_eq!(
        (
            result["may_be_truncated"].as_bool(),
            result["start_date"].as_str()
        ),
        (Some(false), Some("2026-01-01"))
    );
    let requests = server.finish().await;
    assert!(requests[1]
        .to_ascii_lowercase()
        .contains("bearer fixture-access"));
    let full = format!(
        r#"{{"rows":[{}]}}"#,
        vec![r#"{"keys":["2026-01-01"],"clicks":1,"impressions":1}"#; ROW_LIMIT].join(",")
    );
    let server = Server::new(&[TOKEN, ("200 OK", &full)]).await;
    let result = page_daily_with(
        ids("https://a.test/", "https://a.test/x"),
        range(),
        &store(),
        (&server.endpoint, Some(&server.endpoint)),
    )
    .await
    .unwrap();
    assert_eq!(result["may_be_truncated"], true);
    server.finish().await;
    let server = Server::new(&[TOKEN, ("200 OK", "{}")]).await;
    let empty = page_daily_with(
        ids("https://a.test/", "https://a.test/x"),
        range(),
        &store(),
        (&server.endpoint, Some(&server.endpoint)),
    )
    .await
    .unwrap();
    assert_eq!(empty["rows"].as_array().map(Vec::len), Some(0));
    server.finish().await;
}

#[tokio::test]
async fn validates_before_any_network_call() {
    let unused = ("http://127.0.0.1:1", None);
    let bad_client = page_daily_with(
        (
            "p".into(),
            "bad".into(),
            "https://a.test/".into(),
            "https://a.test/x".into(),
        ),
        range(),
        &store(),
        unused,
    )
    .await;
    assert!(bad_client.is_err());
    let outside = page_daily_with(
        ids("https://a.test/", "https://b.test/"),
        range(),
        &store(),
        unused,
    )
    .await;
    assert!(outside.unwrap_err().contains("outside"));
    let bad_date = page_daily_with(
        ids("https://a.test/", "https://a.test/x"),
        (Some("nope".into()), None),
        &store(),
        unused,
    )
    .await;
    assert!(bad_date.is_err());
    let command = search_page("https://a.test/", "https://b.test/").await;
    assert!(command.unwrap_err().contains("outside"));
}

async fn search_page(site: &str, page: &str) -> Result<Value, String> {
    search_console_page_daily(
        "p".into(),
        CLIENT.into(),
        site.into(),
        page.into(),
        None,
        None,
    )
    .await
}
