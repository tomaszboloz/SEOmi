use super::super::headings::build_heading_tree;
use super::super::images::intrinsic_data_uri_dimensions;
use super::super::*;
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};

#[test]
fn test_missing_h1_issue() {
    let html = "<html><body><h2>No H1 here</h2></body></html>";
    let (headings, issues) = parse_headings(html);
    assert_eq!(headings.h1_count, 0);
    assert!(issues.iter().any(|i| i.message.contains("No H1")));
}

#[test]
fn test_multiple_h1_issue() {
    let html = "<html><body><h1>First H1</h1><h1>Second H1</h1></body></html>";
    let (headings, issues) = parse_headings(html);
    assert_eq!(headings.h1_count, 2);
    assert!(issues.iter().any(|i| i.message.contains("Multiple H1")));
}

#[test]
fn builds_a_nested_heading_tree_without_losing_siblings() {
    let tree = build_heading_tree(&[
        (1, "Root".to_string()),
        (2, "First child".to_string()),
        (3, "Grandchild".to_string()),
        (2, "Second child".to_string()),
        (1, "Second root".to_string()),
    ]);
    assert_eq!(tree.len(), 2);
    assert_eq!(tree[0].children.len(), 2);
    assert_eq!(tree[0].children[0].children[0].text, "Grandchild");
    assert_eq!(tree[0].children[1].text, "Second child");
}

#[test]
fn test_images_missing_alt() {
    let html =
        r#"<html><body><img src="pic1.jpg"><img src="pic2.jpg" alt="Description"></body></html>"#;
    let base = Url::parse("https://example.com").unwrap();
    let (images, issues) = parse_images(html, &base);
    assert_eq!(images.len(), 2);
    assert!(!images[0].has_alt);
    assert!(images[1].has_alt);
    assert!(issues.iter().any(|i| i.message.contains("missing 'alt'")));
}

#[test]
fn empty_alt_is_decorative_without_requiring_aria_hidden_or_role() {
    let base = Url::parse("https://example.com").unwrap();
    let (images, issues) = parse_images(
        r#"<img src="decoration.png" alt=""><img src="missing.png">"#,
        &base,
    );
    assert!(images[0].has_alt);
    assert!(!images[1].has_alt);
    let missing = issues
        .iter()
        .find(|i| i.message.contains("missing 'alt'"))
        .unwrap();
    assert_eq!(missing.params.as_ref().unwrap().get("count").unwrap(), "1");
}

#[test]
fn infers_intrinsic_dimensions_from_bounded_data_uris_without_network() {
    let mut png = vec![137, 80, 78, 71, 13, 10, 26, 10];
    png.resize(24, 0);
    png[16..20].copy_from_slice(&2u32.to_be_bytes());
    png[20..24].copy_from_slice(&3u32.to_be_bytes());
    let png_uri = format!("data:image/png;base64,{}", BASE64_STANDARD.encode(png));
    assert_eq!(intrinsic_data_uri_dimensions(&png_uri), Some((2, 3)));

    let svg_uri = "data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%20120%2060%22%3E%3C/svg%3E";
    assert_eq!(intrinsic_data_uri_dimensions(svg_uri), Some((120, 60)));

    let percentage_svg = "data:image/svg+xml,%3Csvg%20width%3D%22100%25%22%20height%3D%2250%25%22%20viewBox%3D%220%200%2080%2040%22%3E%3C/svg%3E";
    assert_eq!(
        intrinsic_data_uri_dimensions(percentage_svg),
        Some((80, 40))
    );
}

#[test]
fn parse_images_marks_intrinsic_dimensions_as_local_evidence() {
    let html = r#"<html><body><img src="data:image/gif;base64,R0lGODlhBAAFAAAA" alt="pixel"></body></html>"#;
    let base = Url::parse("https://example.com").unwrap();
    let (images, issues) = parse_images(html, &base);
    assert_eq!(images[0].width.as_deref(), Some("4"));
    assert_eq!(images[0].height.as_deref(), Some("5"));
    assert_eq!(
        images[0].dimensions_source.as_deref(),
        Some("intrinsic-data-uri")
    );
    assert!(!issues
        .iter()
        .any(|i| i.message.contains("missing explicit width/height")));
}

#[test]
fn test_links_target_blank_security() {
    let html =
        r#"<html><body><a href="https://other.com" target="_blank">External</a></body></html>"#;
    let base = Url::parse("https://example.com").unwrap();
    let (links, issues) = parse_links(html, &base);
    assert_eq!(links.total_links, 1);
    assert_eq!(links.external_links, 1);
    assert!(issues
        .iter()
        .any(|i| i.message.contains("noopener noreferrer")));
}
