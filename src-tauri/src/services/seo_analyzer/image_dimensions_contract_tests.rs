use super::super::{
    intrinsic_data_uri_dimensions, read_be_u16, read_be_u32, read_le_u16, read_le_u24,
};
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};

#[test]
fn contract_dimension_readers_respect_offsets_endianness_and_overflow() {
    let bytes = [0, 0x12, 0x34, 0x56, 0x78];
    assert_eq!(read_be_u16(&bytes, 1), Some(0x1234));
    assert_eq!(read_be_u32(&bytes, 1), Some(0x12345678));
    assert_eq!(read_le_u16(&bytes, 1), Some(0x3412));
    assert_eq!(read_le_u24(&bytes, 1), Some(0x563412));
    for offset in [bytes.len(), usize::MAX] {
        assert_eq!(read_be_u16(&bytes, offset), None);
        assert_eq!(read_be_u32(&bytes, offset), None);
        assert_eq!(read_le_u16(&bytes, offset), None);
        assert_eq!(read_le_u24(&bytes, offset), None);
    }
}

#[test]
fn contract_dimension_decoder_rejects_every_truncated_supported_header() {
    let mut png = vec![0; 24];
    png[..8].copy_from_slice(&[137, 80, 78, 71, 13, 10, 26, 10]);
    png[16..20].copy_from_slice(&2u32.to_be_bytes());
    png[20..24].copy_from_slice(&3u32.to_be_bytes());
    let gif = b"GIF87a\x02\x00\x03\x00".to_vec();
    let mut webp = vec![0; 30];
    webp[..4].copy_from_slice(b"RIFF");
    webp[8..16].copy_from_slice(b"WEBPVP8X");
    webp[24] = 1;
    webp[27] = 2;
    let jpeg = vec![0xff, 0xd8, 0xff, 0xc2, 0, 7, 8, 0, 3, 0, 2];
    for (kind, bytes) in [("png", png), ("gif", gif), ("webp", webp), ("jpeg", jpeg)] {
        for length in 0..bytes.len() {
            let uri = format!(
                "data:image/{kind};base64,{}",
                BASE64_STANDARD.encode(&bytes[..length])
            );
            assert_eq!(
                intrinsic_data_uri_dimensions(&uri),
                None,
                "{kind}: {length}"
            );
        }
        let uri = format!(
            "data:image/{kind};base64,{}",
            BASE64_STANDARD.encode(&bytes)
        );
        assert_eq!(intrinsic_data_uri_dimensions(&uri), Some((2, 3)), "{kind}");
    }
    assert_eq!(
        intrinsic_data_uri_dimensions("https://cdn.test/image.png"),
        None
    );
}

#[test]
fn contract_svg_and_jpeg_edge_paths_remain_bounded() {
    assert_eq!(
        super::super::svg_data_uri_dimensions(r#"<svg width="10"></svg>"#),
        None
    );
    assert_eq!(
        super::super::svg_data_uri_dimensions(r#"<svg viewBox="0 0 20 -1"></svg>"#),
        None
    );
    assert_eq!(
        super::super::svg_data_uri_dimensions(r#"<svg viewBox="0 0 0 20"></svg>"#),
        None
    );
    let jpeg = [
        0xff, 0xd8, 0xff, 0xd8, 0xff, 0xd9, 0xff, 0xe1, 0, 4, 0, 0, 0xff, 0xc0, 0, 7, 8, 0, 5, 0, 7,
    ];
    assert_eq!(
        intrinsic_data_uri_dimensions(&format!(
            "data:image/jpeg;base64,{}",
            BASE64_STANDARD.encode(jpeg)
        )),
        Some((7, 5))
    );
    assert!(intrinsic_data_uri_dimensions(&format!(
        "data:image/jpeg;base64,{}",
        BASE64_STANDARD.encode([0xff, 0xd8, 0xff, 0xff, 0xff, 0xff])
    ))
    .is_none());
    assert!(intrinsic_data_uri_dimensions(&format!(
        "data:image/jpeg;base64,{}",
        BASE64_STANDARD.encode([0xff, 0xd8, 0xff, 0xc0, 0, 6, 8, 0, 2, 0, 3])
    ))
    .is_none());
}
