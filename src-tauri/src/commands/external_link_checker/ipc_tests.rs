use super::command_tests::fixture;
use crate::utils::test_app::invoke;
use serde_json::json;

#[test]
fn generated_ipc_preserves_camel_case_types_and_optional_budget() {
    let app = fixture();
    let view = tauri::WebviewWindowBuilder::new(&app.app, "main", Default::default())
        .build()
        .unwrap();
    let result = invoke(
        &view,
        "check_external_crawl_links",
        json!({"requestId":"ipc", "urls":["ftp://b.test", "ftp://a.test"], "maxUrls":0}),
    )
    .unwrap();
    assert_eq!(result["requested"], 2);
    assert_eq!(result["checked"], 1);
    assert_eq!(result["omitted"], 1);
    assert_eq!(result["results"][0]["url"], "ftp://b.test");
    assert_eq!(result["results"][0]["requestErrorKind"], "invalid");
    assert_eq!(
        invoke(
            &view,
            "check_external_crawl_links",
            json!({"requestId":"empty", "urls":[]})
        )
        .unwrap(),
        json!({"requested":0,"checked":0,"omitted":0,"results":[]})
    );
    assert!(invoke(
        &view,
        "check_external_crawl_links",
        json!({"requestId":1,"urls":[]})
    )
    .is_err());
    assert!(invoke(
        &view,
        "check_external_crawl_links",
        json!({"requestId":"bad","urls":[],"maxUrls":-1})
    )
    .is_err());
}
