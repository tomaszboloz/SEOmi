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
    assert!(include_str!("desktop_e2e.rs").contains("additional_validation_script"));
}

#[test]
fn renderer_html_assertion_and_failure_diagnostics_contract() {
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

    let is_html_valid = |html: &str| !html.is_empty() && html.contains("Example Domain");

    assert!(!is_html_valid(""));
    assert!(!is_html_valid("   "));
    assert!(!is_html_valid("<html><body>Error 404</body></html>"));
    assert!(!is_html_valid(
        "<html><head><title>Cannot Open Page</title></head><body>The URL cannot be shown.</body></html>"
    ));
    assert!(!is_html_valid("<html><body>about:blank</body></html>"));

    assert!(is_html_valid(
        "<!doctype html><html><head><title>Example Domain</title></head><body><h1>Example Domain</h1></body></html>"
    ));
    assert!(is_html_valid(
        "<html><body><p>This is Example Domain for testing.</p></body></html>"
    ));
}
