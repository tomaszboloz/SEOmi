use super::{collect_http_resource, detect_mixed_content_resources};
use std::collections::BTreeSet;
use url::Url;

#[test]
fn contract_mixed_content_normalizes_deduplicates_and_excludes_navigation() {
    let html = r#"<script src="http://CDN.test:80/app.js?one=secret#one"></script>
        <script src="http://cdn.test/app.js?two=secret#two"></script>
        <img src="//cdn.test/secure.png"><img src="/relative.png">
        <link rel="canonical" href="http://cdn.test/canonical">
        <a href="http://cdn.test/navigation">Navigation</a>
        <form action="http://forms.test/submit?session=secret"></form>"#;
    assert_eq!(
        detect_mixed_content_resources(html, &Url::parse("https://example.test/page").unwrap()),
        ["http://cdn.test/app.js", "http://forms.test/submit"]
    );
}

#[test]
fn contract_mixed_content_output_is_deterministic_and_capped_at_one_hundred() {
    let html = (0..105)
        .rev()
        .map(|index| {
            format!(r#"<script src="http://cdn.test/{index:03}.js?private=token"></script>"#)
        })
        .collect::<String>();
    let found = detect_mixed_content_resources(&html, &Url::parse("https://example.test").unwrap());
    let expected = (0..100)
        .map(|index| format!("http://cdn.test/{index:03}.js"))
        .collect::<Vec<_>>();
    assert_eq!(found, expected);
}

#[test]
fn detects_embedded_http_resources_and_strips_tracking_fragments() {
    let html = r#"
        <script src="http://cdn.test/app.js?build=1#top"></script>
        <img src="data:image/png;base64,AAAA" srcset="http://cdn.test/small.png 1x, , http://cdn.test/large.png 2x">
        <img src="blob:https://example.com/id">
        <iframe src="https://safe.test/embed"></iframe><iframe src="http://frame.test/frame"></iframe>
        <source src="http://media.test/source.mp4" srcset="http://media.test/one.mp4 1x">
        <video src="http://video.test/video.mp4"></video><audio src="http://audio.test/audio.mp3"></audio>
        <track src="http://media.test/captions.vtt"><embed src="http://embed.test/file.swf">
        <object data="http://object.test/file.bin"></object><form action="http://form.test/submit"></form>
        <link rel="stylesheet" href="http://style.test/main.css?theme=dark">
        <link rel="preload" href="http://font.test/font.woff2#font">
        <div style="background:url('http://css.test/bg.png?x=1#bg');mask:url(data:image/png;base64,AAAA)"></div>
        <div style="color:red"></div><div style="background:url()"></div>
    "#;
    let page = Url::parse("https://example.com/path/page").unwrap();
    let found = detect_mixed_content_resources(html, &page);

    for expected in [
        "http://cdn.test/app.js",
        "http://frame.test/frame",
        "http://media.test/source.mp4",
        "http://video.test/video.mp4",
        "http://audio.test/audio.mp3",
        "http://media.test/captions.vtt",
        "http://embed.test/file.swf",
        "http://object.test/file.bin",
        "http://form.test/submit",
        "http://style.test/main.css",
        "http://font.test/font.woff2",
        "http://css.test/bg.png",
    ] {
        assert!(
            found.iter().any(|resource| resource == expected),
            "missing {expected}"
        );
    }
    assert!(!found
        .iter()
        .any(|resource| resource.starts_with("https://")));
    assert!(!found
        .iter()
        .any(|resource| resource.contains('?') || resource.contains('#')));
}

#[test]
fn ignores_non_https_pages_and_non_http_resource_values() {
    let html = r#"<img src="https://safe.test/a.png"><img src="data:image/png;base64,AAAA"><img src="blob:x">"#;
    assert!(
        detect_mixed_content_resources(html, &Url::parse("http://example.com").unwrap()).is_empty()
    );

    let page = Url::parse("https://example.com").unwrap();
    let mut found = BTreeSet::new();
    for value in [
        "",
        "data:image/png;base64,AAAA",
        "blob:x",
        "https://safe.test/a.png",
    ] {
        collect_http_resource(value, &page, &mut found);
    }
    assert!(found.is_empty());
}

#[test]
fn detects_frame_resources_in_a_valid_frameset_document() {
    let page = Url::parse("https://example.com").unwrap();
    assert_eq!(
        detect_mixed_content_resources(
            r#"<html><head></head><frameset><frame src="http://frame.test/frame"></frameset></html>"#,
            &page
        ),
        ["http://frame.test/frame"]
    );
}
