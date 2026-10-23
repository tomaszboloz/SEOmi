use super::labels::{enter, t, tf};
use serde_json::json;

#[test]
fn overlay_ignores_empty_text_and_tf_fills_placeholders() {
    let _scope = enter(&json!({
        "pdf_labels": { "x": { "k": "{{1}} before {{0}}", "empty": "" } }
    }));
    assert_eq!(t("x.k"), "{{1}} before {{0}}");
    assert_eq!(tf("x.k", &["a", "b"]), "b before a");
    assert_eq!(t("x.empty"), "x.empty");
}
