use super::*;

#[test]
fn asset_names_require_exact_or_versioned_filename_boundaries() {
    for source in [
        "/jquery.js",
        "/jquery-3.7.js",
        "/jquery_3.js",
        "/jquery@3.js",
        "/jquery?x=1",
        "/jquery.min.js#x",
    ] {
        assert!(asset_starts_with(source, "jquery"), "{source}");
    }
    for source in [
        "/notjquery.js",
        "/jquery-plugin.js",
        "/jquery-x",
        "/jquery3.js",
    ] {
        assert!(!asset_starts_with(source, "jquery"), "{source}");
    }
}

#[test]
fn actual_asset_signals_preserve_stylesheet_script_and_directive_evidence() {
    let html = "<script src='/jquery.min.js'></script><script src='/alpinejs@3.js'></script><link href='/bootstrap.css'><script src='/tailwindcss.js'></script><script src='https://plausible.io/js/script.js'></script>";
    let document = Html::parse_document(html);
    let mut signals = Vec::new();
    asset_signals(&document, html, &mut signals);
    for name in [
        "jQuery",
        "Alpine.js",
        "Bootstrap",
        "Tailwind CSS",
        "Plausible Analytics",
    ] {
        assert_eq!(
            signals.iter().find(|s| s.name == name).unwrap().confidence,
            "confirmed"
        );
    }
    signals.clear();
    asset_signals(
        &Html::parse_document("<div x-data='{}'></div>"),
        "x-data=",
        &mut signals,
    );
    assert_eq!(signals.len(), 1);
    assert_eq!(signals[0].name, "Alpine.js");
    assert_eq!(signals[0].confidence, "heuristic");
}

#[test]
fn plausible_source_validation_uses_http_host_boundaries() {
    for source in [
        "https://plausible.io/js/script.js",
        "//PLAUSIBLE.IO/js/script.js",
        "https://analytics.plausible.io/script.js",
    ] {
        assert!(plausible_script_source(source), "{source}");
    }
    for source in [
        "invalid",
        "file:///plausible.io/script.js",
        "https://notplausible.io/script.js",
        "https://plausible.io.example.com/script.js",
        "/plausible.io/script.js",
    ] {
        assert!(!plausible_script_source(source), "{source}");
    }
}
