use super::intrinsic_http_image_dimensions;

fn ico(entries: &[(u8, u8)]) -> Vec<u8> {
    let mut bytes = vec![0, 0, 1, 0];
    bytes.extend_from_slice(&(entries.len() as u16).to_le_bytes());
    for &(width, height) in entries {
        bytes.extend_from_slice(&[width, height, 0, 0, 1, 0, 32, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    }
    bytes
}

#[test]
fn ico_zero_dimension_bytes_mean_256_pixels_and_win_largest_entry_selection() {
    assert_eq!(
        intrinsic_http_image_dimensions(Some("image/x-icon"), &ico(&[(32, 32), (0, 0)])),
        Some((256, 256))
    );
    assert_eq!(
        intrinsic_http_image_dimensions(None, &ico(&[(0, 16), (32, 32)])),
        Some((256, 16))
    );
}

#[test]
fn partial_ico_directory_does_not_invent_an_additional_candidate() {
    let mut bytes = ico(&[(16, 16), (64, 64)]);
    bytes.truncate(25);
    assert_eq!(
        intrinsic_http_image_dimensions(None, &bytes),
        Some((16, 16))
    );
    assert_eq!(intrinsic_http_image_dimensions(None, &bytes[..6]), None);
}

#[test]
fn truncated_supported_headers_and_unknown_formats_have_no_dimensions() {
    for bytes in [
        &[][..],
        &[0, 0, 1, 0],
        &[137, 80, 78, 71, 13, 10, 26, 10],
        b"GIF87a\x01",
        b"RIFF\x00\x00\x00\x00WEBPVP8X",
        &[0xff, 0xd8, 0xff, 0xc0, 0, 7, 8],
        b"unknown format",
    ] {
        assert_eq!(intrinsic_http_image_dimensions(None, bytes), None);
    }
}

#[test]
fn jpeg_scans_padding_and_metadata_before_a_dimension_marker() {
    let bytes = [
        0xff, 0xd8, 0x00, 0xff, 0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc2, 0, 7, 8, 0, 24, 0,
        48,
    ];
    assert_eq!(
        intrinsic_http_image_dimensions(None, &bytes),
        Some((48, 24))
    );
}

#[test]
fn invalid_jpeg_segment_lengths_and_marker_only_streams_are_rejected() {
    for bytes in [
        &[0xff, 0xd8, 0xff, 0xe0, 0, 1][..],
        &[0xff, 0xd8, 0xff, 0xe0, 0, 9],
        &[0xff, 0xd8, 0xff, 0xff, 0xff, 0xff],
        &[0xff, 0xd8, 0xff, 0xd9, 0, 0],
        &[0xff, 0xd8, 0xff, 0xc0, 0, 4, 8, 0],
    ] {
        assert_eq!(intrinsic_http_image_dimensions(None, bytes), None);
    }
}

#[test]
fn svg_dimensions_are_sniffed_when_the_content_type_is_absent() {
    for bytes in [
        br#"<?xml version="1.0"?><svg width="24" height="48"></svg>"#.as_slice(),
        br#"<svg width="24" height="48"></svg>"#,
    ] {
        assert_eq!(intrinsic_http_image_dimensions(None, bytes), Some((24, 48)));
    }
}

#[test]
fn unrelated_riff_and_unsupported_webp_chunks_do_not_claim_dimensions() {
    for bytes in [
        b"RIFF\x00\x00\x00\x00WAVEfmt ".as_slice(),
        b"RIFF\x00\x00\x00\x00WEBPVP8 ",
    ] {
        assert_eq!(intrinsic_http_image_dimensions(None, bytes), None);
    }
}
