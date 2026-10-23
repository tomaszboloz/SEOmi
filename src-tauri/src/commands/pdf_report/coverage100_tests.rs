use super::{labels, renderer};
use serde_json::json;

#[test]
fn label_overlay_handles_nested_scalars_and_unknown_keys() {
    let payload = json!({
        "pdf_labels": {"report": {"title": "Overlay title"}, "ignored": 42, "list": ["x"]}
    });
    let scope = labels::enter(&payload);
    assert_eq!(labels::t("report.title"), "Overlay title");
    assert_eq!(labels::t("missing.key"), "missing.key");
    assert!(labels::default_keys()
        .iter()
        .any(|key| key.contains("report")));
    drop(scope);

    let mut fonts = super::font::FontSet::new();
    let encoded = renderer::encoded_text(&mut fonts, 10, "A");
    assert!(encoded.contains("Tf") && encoded.contains("Tj"));
}
