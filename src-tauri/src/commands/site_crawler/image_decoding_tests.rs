use super::*;

#[test]
fn ico_zero_dimension_bytes_represent_256_and_largest_entry_wins() {
    let mut bytes = vec![0u8; 6 + 3 * 16];
    bytes[..6].copy_from_slice(&[0, 0, 1, 0, 3, 0]);
    bytes[6] = 16;
    bytes[7] = 16;
    bytes[22] = 0;
    bytes[23] = 0;
    bytes[38] = 32;
    bytes[39] = 32;
    assert_eq!(
        intrinsic_http_image_dimensions(None, &bytes),
        Some((256, 256))
    );
    bytes[4] = 1;
    bytes[6] = 0;
    bytes[7] = 48;
    assert_eq!(
        intrinsic_http_image_dimensions(None, &bytes),
        Some((256, 48))
    );
    bytes.truncate(12);
    assert_eq!(intrinsic_http_image_dimensions(None, &bytes), None);
    bytes.truncate(6);
    assert_eq!(intrinsic_http_image_dimensions(None, &bytes), None);
}

#[test]
fn dimension_reads_are_exact_and_reject_every_truncated_prefix() {
    let bytes = [1, 2, 3, 4];
    assert_eq!(read_be_u16(&bytes, 0), Some(258));
    assert_eq!(read_be_u32(&bytes, 0), Some(16909060));
    assert_eq!(read_le_u16(&bytes, 0), Some(513));
    assert_eq!(read_le_u24(&bytes, 0), Some(197121));
    for length in 0..2 {
        assert_eq!(read_be_u16(&bytes[..length], 0), None);
        assert_eq!(read_le_u16(&bytes[..length], 0), None);
    }
    for length in 0..4 {
        assert_eq!(read_be_u32(&bytes[..length], 0), None);
    }
    for length in 0..3 {
        assert_eq!(read_le_u24(&bytes[..length], 0), None);
    }
    assert_eq!(read_be_u16(&bytes, 4), None);
    assert_eq!(read_be_u32(&bytes, 4), None);
    assert_eq!(read_le_u16(&bytes, 4), None);
    assert_eq!(read_le_u24(&bytes, 4), None);
}

#[test]
fn malformed_jpeg_segments_and_truncated_format_headers_are_unavailable() {
    let cases: &[&[u8]] = &[
        &[],
        b"unknown",
        b"GIF87a",
        b"GIF89a",
        &[137, 80, 78, 71, 13, 10, 26, 10],
        &[0xff, 0xd8, 0, 0, 0, 0],
        &[0xff, 0xd8, 0xff, 0xff, 0xff, 0xff],
        &[0xff, 0xd8, 0xff, 0xd9, 0xff, 0xd8, 0, 0],
        &[0xff, 0xd8, 0xff, 0xc0, 0, 1],
        &[0xff, 0xd8, 0xff, 0xc0, 0, 20],
        &[0xff, 0xd8, 0xff, 0xe0, 0, 2],
        &[0xff, 0xd8, 0xff, 0xc0, 0, 2],
    ];
    for bytes in cases {
        assert_eq!(
            intrinsic_http_image_dimensions(None, bytes),
            None,
            "{bytes:?}"
        );
    }
    let mut webp = vec![0u8; 24];
    webp[..4].copy_from_slice(b"RIFF");
    webp[8..12].copy_from_slice(b"WEBP");
    webp[12..16].copy_from_slice(b"VP8X");
    assert_eq!(intrinsic_http_image_dimensions(None, &webp), None);
    assert_eq!(
        intrinsic_http_image_dimensions(Some("image/svg+xml"), b"invalid svg"),
        None
    );
}
