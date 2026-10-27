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

#[test]
fn generated_ipc_handles_urls_invocation_via_cmd() {
    let app = fixture();
    let view = tauri::WebviewWindowBuilder::new(&app.app, "main", Default::default())
        .build()
        .unwrap();
    assert!(invoke(
        &view,
        "check_external_crawl_links",
        json!({"urls": ["https://example.test"]}),
    )
    .is_err());
    assert!(invoke(
        &view,
        "check_external_crawl_links",
        json!({"requestId": "bad", "urls": "not-array"}),
    )
    .is_err());
    assert!(invoke(
        &view,
        "check_external_crawl_links",
        json!({"requestId": "bad", "urls": [123]}),
    )
    .is_err());
}

#[test]
fn generated_ipc_handles_null_budget_and_input_cap() {
    let app = fixture();
    let view = tauri::WebviewWindowBuilder::new(&app.app, "main", Default::default())
        .build()
        .unwrap();
    let res = invoke(
        &view,
        "check_external_crawl_links",
        json!({"requestId": "null-budget", "urls": ["ftp://target.test"], "maxUrls": null}),
    )
    .unwrap();
    assert_eq!(res["requested"], 1);
    assert_eq!(res["checked"], 1);
    assert!(res["results"][0]["checkedAt"].is_string());

    let overflow: Vec<String> = (0..20_001).map(|i| format!("ftp://t{i}.test")).collect();
    let err = invoke(
        &view,
        "check_external_crawl_links",
        json!({"requestId": "overflow", "urls": overflow}),
    )
    .unwrap_err();
    assert!(err.to_string().contains("maximum input: 20,000"));
}
