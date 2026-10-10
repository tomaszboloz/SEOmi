use super::{
    intrinsic_data_uri_dimensions, percent_decode_data, read_be_u16, read_le_u24,
    svg_data_uri_dimensions,
};
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};

#[path = "image_dimensions_contract_tests.rs"]
mod contract_tests;

fn data_uri(kind: &str, bytes: &[u8]) -> String {
    format!("data:image/{kind};base64,{}", BASE64_STANDARD.encode(bytes))
}

#[test]
fn bounded_readers_and_percent_decoding_reject_truncated_or_invalid_data() {
    assert_eq!(read_be_u16(&[0x12, 0x34], 0), Some(0x1234));
    assert_eq!(read_be_u16(&[0x12], 0), None);
    assert_eq!(read_le_u24(&[1, 2, 3], 0), Some(0x030201));
    assert_eq!(read_le_u24(&[1, 2], 0), None);
    assert_eq!(percent_decode_data("width%3D20"), Some("width=20".into()));
    assert_eq!(percent_decode_data("bad%ZZ"), None);
    assert_eq!(percent_decode_data("bad%FF"), None);
    assert_eq!(percent_decode_data("%4a%4B%4c"), Some("JKL".into()));
    assert_eq!(percent_decode_data("bad%"), None);
}

#[test]
fn svg_dimensions_support_numeric_attributes_and_safe_fallbacks() {
    assert_eq!(
        svg_data_uri_dimensions(r#"<svg width="120" height="60"></svg>"#),
        Some((120, 60))
    );
    assert_eq!(
        svg_data_uri_dimensions(r#"<svg viewBox="0 0 -1 40"></svg>"#),
        None
    );
    assert_eq!(
        svg_data_uri_dimensions(r#"<svg viewbox="0,0,320,180"></svg>"#),
        Some((320, 180))
    );
    assert_eq!(
        svg_data_uri_dimensions(r#"<svg viewBox="0 0 20"></svg>"#),
        None
    );
    assert_eq!(svg_data_uri_dimensions("<div></div>"), None);

    assert_eq!(
        intrinsic_data_uri_dimensions(&data_uri(
            "svg+xml",
            br#"<svg width="80" height="40"></svg>"#,
        )),
        Some((80, 40))
    );
    assert_eq!(
        intrinsic_data_uri_dimensions("data:image/svg+xml;base64,not-base64"),
        None
    );
    assert_eq!(
        intrinsic_data_uri_dimensions("data:image/svg+xml,bad%FF"),
        None
    );
}

#[test]
fn webp_jpeg_and_unsupported_raster_payloads_are_bounded() {
    let mut webp = vec![0; 30];
    webp[0..4].copy_from_slice(b"RIFF");
    webp[8..12].copy_from_slice(b"WEBP");
    webp[12..16].copy_from_slice(b"VP8X");
    webp[24..27].copy_from_slice(&299u32.to_le_bytes()[..3]);
    webp[27..30].copy_from_slice(&399u32.to_le_bytes()[..3]);
    assert_eq!(
        intrinsic_data_uri_dimensions(&data_uri("webp", &webp)),
        Some((300, 400))
    );

    let jpeg = [0xff, 0xd8, 0xff, 0xc0, 0, 11, 8, 0, 3, 0, 2, 0, 0, 0, 0];
    assert_eq!(
        intrinsic_data_uri_dimensions(&data_uri("jpeg", &jpeg)),
        Some((2, 3))
    );
    assert!(
        intrinsic_data_uri_dimensions(&data_uri("jpeg", &[0xff, 0xd8, 0xff, 0xc0, 0, 1])).is_none()
    );
    assert!(intrinsic_data_uri_dimensions("data:image/png;base64,not-base64").is_none());
    assert!(intrinsic_data_uri_dimensions("data:text/plain;base64,AAAA").is_none());
    assert!(intrinsic_data_uri_dimensions("data:image/png").is_none());
}

#[test]
fn raster_signatures_and_jpeg_segments_report_dimensions_without_network() {
    let mut png = vec![0; 24];
    png[..8].copy_from_slice(&[137, 80, 78, 71, 13, 10, 26, 10]);
    png[16..20].copy_from_slice(&640u32.to_be_bytes());
    png[20..24].copy_from_slice(&480u32.to_be_bytes());
    assert_eq!(
        intrinsic_data_uri_dimensions(&data_uri("png", &png)),
        Some((640, 480))
    );
    assert!(intrinsic_data_uri_dimensions(&data_uri("png", &png[..8])).is_none());

    let mut gif = vec![0; 10];
    gif[..6].copy_from_slice(b"GIF89a");
    gif[6..8].copy_from_slice(&320u16.to_le_bytes());
    gif[8..10].copy_from_slice(&200u16.to_le_bytes());
    assert_eq!(
        intrinsic_data_uri_dimensions(&data_uri("gif", &gif)),
        Some((320, 200))
    );

    let jpeg = [
        0xff, 0xd8, 0x01, 0xff, 0xff, 0xe0, 0, 2, 0xff, 0xc0, 0, 10, 8, 0, 5, 0, 7, 0, 0, 0,
    ];
    assert_eq!(
        intrinsic_data_uri_dimensions(&data_uri("jpeg", &jpeg)),
        Some((7, 5))
    );
    assert!(
        intrinsic_data_uri_dimensions(&data_uri("jpg", &[0xff, 0xd8, 0xff, 0xd8, 0xff, 0xd9]))
            .is_none()
    );
    assert!(
        intrinsic_data_uri_dimensions(&data_uri("jpg", &[0xff, 0xd8, 0xff, 0xe0, 0, 10, 0]))
            .is_none()
    );
}

#[test]
fn image_payload_guards_reject_oversized_and_wrong_container_headers() {
    let oversized = vec![0u8; 8 * 1024 * 1024 + 1];
    assert!(intrinsic_data_uri_dimensions(&data_uri("png", &oversized)).is_none());

    let mut wrong = vec![0; 30];
    wrong[..4].copy_from_slice(b"RIFF");
    wrong[8..12].copy_from_slice(b"NOPE");
    assert!(intrinsic_data_uri_dimensions(&data_uri("webp", &wrong)).is_none());
    wrong[8..12].copy_from_slice(b"WEBP");
    wrong[12..16].copy_from_slice(b"NOPE");
    assert!(intrinsic_data_uri_dimensions(&data_uri("webp", &wrong)).is_none());
}
