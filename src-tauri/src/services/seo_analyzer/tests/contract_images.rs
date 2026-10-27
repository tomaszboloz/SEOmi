use super::super::images::parse_images;
use crate::models::audit_data::IssueSeverity;
use url::Url;

#[test]
fn contract_images_preserve_attribute_precedence_and_dimension_provenance() {
    let html = r#"
        <img><img src=" ">
        <img src="data:image/gif;base64,R0lGODlhBAAFAAAA" alt="" width=" 20 " height=" 30 ">
        <img src="data:image/gif;base64,R0lGODlhBAAFAAAA" alt="Pixel" width="10">
        <img src="data:image/gif;base64,R0lGODlhBAAFAAAA" alt="Pixel">
        <img src="/remote.webp" alt="Remote" width="40" loading=" lazy " srcset=" /remote.webp 1x ">
    "#;
    let (images, issues) = parse_images(html, &Url::parse("https://example.test/page").unwrap());
    assert_eq!(images.len(), 4);
    for (index, width, height, source) in [
        (0, "20", "30", "attributes"),
        (1, "10", "5", "mixed"),
        (2, "4", "5", "intrinsic-data-uri"),
    ] {
        assert_eq!(images[index].width.as_deref(), Some(width));
        assert_eq!(images[index].height.as_deref(), Some(height));
        assert_eq!(images[index].dimensions_source.as_deref(), Some(source));
    }
    assert!(images[0].has_alt);
    assert_eq!(images[3].src, "https://example.test/remote.webp");
    assert_eq!(images[3].height, None);
    assert_eq!(images[3].dimensions_source, None);
    assert_eq!(images[3].loading.as_deref(), Some("lazy"));
    assert_eq!(images[3].srcset.as_deref(), Some("/remote.webp 1x"));
    assert_eq!(issues.len(), 1);
    assert_eq!(issues[0].code.as_deref(), Some("images_dimensions_missing"));
    assert_eq!(issues[0].params.as_ref().unwrap()["count"], "1");
}

#[test]
fn contract_images_alt_findings_aggregate_and_escalate_above_five() {
    for (count, severity) in [(5, IssueSeverity::Warning), (6, IssueSeverity::Critical)] {
        let html = "<img src='/photo.png' width='1' height='1'>".repeat(count);
        let (images, issues) = parse_images(&html, &Url::parse("https://example.test").unwrap());
        assert_eq!(images.len(), count);
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].code.as_deref(), Some("images_alt_missing"));
        assert_eq!(issues[0].severity, severity);
        assert_eq!(
            issues[0].params.as_ref().unwrap()["count"],
            count.to_string()
        );
    }
}
