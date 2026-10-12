use super::*;

fn names(html: &str) -> Vec<String> {
    let document = Html::parse_document(html);
    let mut signals = Vec::new();
    asset_signals(&document, &html.to_ascii_lowercase(), &mut signals);
    signals.into_iter().map(|signal| signal.name).collect()
}

#[test]
fn bootstrap_and_tailwind_are_detected_from_script_sources_alone() {
    let found = names(
        r#"<script src="/bootstrap.bundle.js"></script><script src="/tailwindcss.js"></script>"#,
    );
    assert!(found.contains(&"Bootstrap".to_string()));
    assert!(found.contains(&"Tailwind CSS".to_string()));
}
