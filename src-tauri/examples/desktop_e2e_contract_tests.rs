#[path = "desktop_e2e_assets.rs"]
mod assets;

#[test]
fn validation_scripts_match_the_runtime_gate() {
    let base = include_str!("desktop_e2e_validation.js");
    let additional = include_str!("desktop_e2e_additional.js");
    let renderer = include_str!("desktop_e2e_renderer.js");
    let crawl = include_str!("desktop_e2e_crawl.js");
    let count = |source: &str| {
        source
            .lines()
            .filter(|line| {
                let line = line.trim_start();
                line.starts_with("check('")
                    || line.starts_with("await reject(")
                    || line.starts_with("await rejectMatch(")
            })
            .count()
    };
    assert_eq!(count(base), 40);
    assert_eq!(count(additional), 24);
    let ipc = include_str!("desktop_e2e_ipc.js");
    let ipc_count: usize = ipc
        .lines()
        .filter(|line| line.trim_start().starts_with("['"))
        .map(|line| {
            line.split("', '")
                .nth(1)
                .unwrap()
                .split('\'')
                .next()
                .unwrap()
                .split_whitespace()
                .filter(|field| !field.ends_with(":v"))
                .count()
        })
        .sum();
    assert_eq!(ipc_count, 135);
    assert_eq!(40 + 24 + ipc_count, super::REQUIRED_VALIDATION_CHECKS);
    assert!(base.contains("__seomiDesktopIpcValidation.run"));
    assert_eq!(super::REQUIRED_RENDERER_CHECKS, 48);
    assert_eq!(crawl.matches("check(`${label}").count(), 11);
    assert!(renderer.contains("__seomiDesktopCrawlValidation"));
    assert!(crawl.contains("crawlMode: mode"));
    assert!(additional.contains("window.__seomiDesktopAdditionalValidation"));
    let ui = include_str!("desktop_e2e_ui.js");
    for tab in [
        "settings-modal-title",
        "ai-assistant-title",
        "ai-connections-title",
        "audit-history-title",
        "create-project-title",
        "keyword-research",
        "mcp-hub",
        "seo-tools",
    ] {
        assert!(ui.contains(tab), "UI smoke must cover {tab}");
    }
    assert!(include_str!("desktop_e2e.rs").contains("desktop_e2e_ui.js"));
    assert!(include_str!("desktop_e2e.rs").contains("additional_validation_script"));
}

#[test]
fn embedded_frontend_assets_use_browser_mime_types() {
    let context = assets::verified_context();
    let summary = assets::assert_embedded_frontend_mime(&context);

    assert!(summary.script_count > 0);
    assert!(summary.stylesheet_count > 0);
}

#[test]
fn renderer_script_wires_strict_html_assertion_and_diagnostics() {
    let renderer = include_str!("desktop_e2e_renderer.js");
    assert!(
        renderer.contains(
            "check('renderer HTML captured', html.length > 0 && html.includes('Example Domain'))"
        ),
        "renderer must enforce strict non-empty Example Domain HTML assertion"
    );
    assert!(
        !renderer.contains("html.length === 0 ||") && !renderer.contains("|| true"),
        "renderer must not contain blanket pass or empty-HTML bypass"
    );
    assert!(
        renderer.contains("htmlLength:")
            && renderer.contains("htmlSnippet:")
            && renderer.contains("observedFinalUrl:")
            && renderer.contains("failedResourceUrls:"),
        "renderer must capture bounded diagnostics for CI triage"
    );
}
