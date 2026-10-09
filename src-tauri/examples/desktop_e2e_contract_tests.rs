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
    assert_eq!(count(base), 39);
    assert_eq!(count(additional), 24);
    assert_eq!(39 + 24, super::REQUIRED_VALIDATION_CHECKS);
    assert_eq!(super::REQUIRED_RENDERER_CHECKS, 48);
    assert_eq!(crawl.matches("check(`${label}").count(), 11);
    assert!(renderer.contains("__seomiDesktopCrawlValidation"));
    assert!(crawl.contains("crawlMode: mode"));
    assert!(additional.contains("window.__seomiDesktopAdditionalValidation"));
    assert!(include_str!("desktop_e2e.rs").contains("additional_validation_script"));
}
