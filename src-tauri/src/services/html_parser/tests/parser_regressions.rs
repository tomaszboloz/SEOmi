use super::*;

#[test]
fn root_discovery_urls_preserve_http_origin_ports_and_ipv6_hosts() {
    for (base, origin) in [
        (
            "https://example.com:8443/path?q=1",
            "https://example.com:8443",
        ),
        (
            "http://[2001:db8::1]:8080/path",
            "http://[2001:db8::1]:8080",
        ),
        ("https://example.com/path", "https://example.com"),
    ] {
        let parsed = parse_html("<html></html>", base).unwrap();
        assert_eq!(
            parsed.technical.robots_txt_url,
            Some(format!("{origin}/robots.txt"))
        );
        assert_eq!(
            parsed.technical.sitemap_url,
            Some(format!("{origin}/sitemap.xml"))
        );
    }
}

#[test]
fn non_http_bases_do_not_fabricate_robots_or_sitemap_addresses() {
    for base in [
        "invalid",
        "file:///tmp/page.html",
        "mailto:owner@example.com",
    ] {
        let parsed = parse_html("<html></html>", base).unwrap();
        assert!(parsed.technical.robots_txt_url.is_none(), "{base}");
        assert!(parsed.technical.sitemap_url.is_none(), "{base}");
    }
}

#[test]
fn joomla_generator_version_uses_the_matched_declaration_prefix() {
    for generator in ["Joomla! 5.3", "Joomla 5.3"] {
        let source = format!("<meta name='generator' content='{generator}'>");
        let parsed = parse_html(&source, "https://example.com").unwrap();
        let cms = parsed
            .technical
            .technology_signals
            .iter()
            .find(|signal| signal.name == "Joomla")
            .unwrap();
        assert_eq!(cms.version.as_deref(), Some("5.3"), "{generator}");
    }
}

#[test]
fn plausible_markers_require_real_host_evidence() {
    for src in [
        "https://notplausible.io/script.js",
        "https://plausible.io.evil.test/script.js",
        "https://example.com/plausible.io/script.js",
    ] {
        let source = format!("<script src='{src}'></script>");
        let parsed = parse_html(&source, "https://example.com").unwrap();
        assert!(
            !parsed
                .technical
                .technology_signals
                .iter()
                .any(|signal| signal.name == "Plausible Analytics"),
            "{src}"
        );
    }
}

#[test]
fn plausible_host_evidence_accepts_case_insensitive_and_protocol_relative_sources() {
    for src in [
        "https://PLAUSIBLE.IO/js/script.js",
        "//plausible.io/js/script.js",
    ] {
        let source = format!("<script src='{src}'></script>");
        let parsed = parse_html(&source, "https://example.com").unwrap();
        assert!(
            parsed
                .technical
                .technology_signals
                .iter()
                .any(|signal| signal.name == "Plausible Analytics"),
            "{src}"
        );
    }
}

#[test]
fn favicon_formats_use_the_asset_filename_instead_of_hostname_dots() {
    for href in [
        "/plain",
        "https://assets.example.com/no-extension",
        "/dir.with.dot/plain",
        "/trailing.",
    ] {
        let source = format!("<link rel='icon' href='{href}'>");
        let parsed = parse_html(&source, "https://example.com").unwrap();
        assert!(
            parsed.technical.favicons[0].inferred_format.is_none(),
            "{href}"
        );
    }
    let parsed = parse_html(
        "<link rel='icon' href='/icons/icon.SVG?v=1#x'>",
        "https://example.com",
    )
    .unwrap();
    assert_eq!(
        parsed.technical.favicons[0].inferred_format.as_deref(),
        Some("svg")
    );
}
