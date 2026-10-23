use super::*;

fn webp(chunk: &[u8; 4], payload: &[u8]) -> Vec<u8> {
    let mut bytes = b"RIFF\0\0\0\0WEBP".to_vec();
    bytes.extend_from_slice(chunk);
    bytes.extend_from_slice(&[0; 4]);
    bytes.extend_from_slice(payload);
    bytes
}

#[test]
fn lossy_webp_reads_masked_14_bit_dimensions() {
    let mut payload = vec![0, 0, 0, 0x9d, 0x01, 0x2a];
    payload.extend_from_slice(&(640u16 | 0xc000).to_le_bytes());
    payload.extend_from_slice(&480u16.to_le_bytes());
    assert_eq!(
        intrinsic_http_image_dimensions(Some("image/webp"), &webp(b"VP8 ", &payload)),
        Some((640, 480))
    );
    payload[3] = 0;
    assert_eq!(webp_dimensions(&webp(b"VP8 ", &payload)), None);
}

#[test]
fn lossless_webp_unpacks_bit_fields() {
    // width 300 -> 299, height 200 -> 199 packed little-endian in 14-bit fields.
    let packed: u32 = 299 | (199 << 14);
    let mut payload = vec![0x2f];
    payload.extend_from_slice(&packed.to_le_bytes());
    assert_eq!(webp_dimensions(&webp(b"VP8L", &payload)), Some((300, 200)));
    payload[0] = 0;
    assert_eq!(webp_dimensions(&webp(b"VP8L", &payload)), None);
    assert_eq!(webp_dimensions(&webp(b"ABCD", &payload)), None);
    assert_eq!(webp_dimensions(b"RIFF"), None);
}

fn avif(boxes: &[(usize, usize)]) -> Vec<u8> {
    let mut bytes = vec![0, 0, 0, 0x14];
    bytes.extend_from_slice(b"ftypavif");
    for (width, height) in boxes {
        bytes.extend_from_slice(&[0, 0, 0, 0x14]);
        bytes.extend_from_slice(b"ispe");
        bytes.extend_from_slice(&[0; 4]);
        bytes.extend_from_slice(&(*width as u32).to_be_bytes());
        bytes.extend_from_slice(&(*height as u32).to_be_bytes());
    }
    bytes.extend_from_slice(&[0; 16]);
    bytes
}

#[test]
fn avif_returns_largest_ispe_and_ignores_zero_or_foreign_brands() {
    assert_eq!(
        intrinsic_http_image_dimensions(Some("image/avif"), &avif(&[(64, 64), (1200, 800)])),
        Some((1200, 800))
    );
    assert_eq!(avif_dimensions(&avif(&[(0, 10)])), None);
    assert_eq!(avif_dimensions(&avif(&[])), None);
    let mut foreign = avif(&[(10, 10)]);
    foreign[8..12].copy_from_slice(b"mp42");
    assert_eq!(avif_dimensions(&foreign), None);
    assert_eq!(avif_dimensions(b"short"), None);
}

#[test]
fn bmp_reads_core_and_info_headers_including_top_down_height() {
    let mut info = vec![0u8; 30];
    info[..2].copy_from_slice(b"BM");
    info[14..18].copy_from_slice(&40u32.to_le_bytes());
    info[18..22].copy_from_slice(&320u32.to_le_bytes());
    info[22..26].copy_from_slice(&(-200i32).to_le_bytes());
    assert_eq!(
        intrinsic_http_image_dimensions(None, &info),
        Some((320, 200))
    );
    let mut core = vec![0u8; 22];
    core[..2].copy_from_slice(b"BM");
    core[14..18].copy_from_slice(&12u32.to_le_bytes());
    core[18..20].copy_from_slice(&16u16.to_le_bytes());
    core[20..22].copy_from_slice(&9u16.to_le_bytes());
    assert_eq!(bmp_dimensions(&core), Some((16, 9)));
    core[20..22].copy_from_slice(&0u16.to_le_bytes());
    assert_eq!(bmp_dimensions(&core), None);
    assert_eq!(bmp_dimensions(b"BM"), None);
    assert_eq!(bmp_dimensions(b"XX"), None);
}

fn tiff(little: bool, entries: &[(u16, u16, u32)]) -> Vec<u8> {
    let u16b = |v: u16| {
        if little {
            v.to_le_bytes()
        } else {
            v.to_be_bytes()
        }
    };
    let u32b = |v: u32| {
        if little {
            v.to_le_bytes()
        } else {
            v.to_be_bytes()
        }
    };
    let mut bytes = if little {
        b"II*\0".to_vec()
    } else {
        b"MM\0*".to_vec()
    };
    bytes.extend_from_slice(&u32b(8));
    bytes.extend_from_slice(&u16b(entries.len() as u16));
    for (tag, kind, value) in entries {
        bytes.extend_from_slice(&u16b(*tag));
        bytes.extend_from_slice(&u16b(*kind));
        bytes.extend_from_slice(&u32b(1));
        if *kind == 3 {
            bytes.extend_from_slice(&u16b(*value as u16));
            bytes.extend_from_slice(&[0, 0]);
        } else {
            bytes.extend_from_slice(&u32b(*value));
        }
    }
    bytes
}

#[test]
fn tiff_reads_short_and_long_entries_in_both_byte_orders() {
    for little in [true, false] {
        let bytes = tiff(little, &[(254, 4, 0), (256, 3, 800), (257, 4, 70_000)]);
        assert_eq!(
            intrinsic_http_image_dimensions(Some("image/tiff"), &bytes),
            Some((800, 70_000))
        );
    }
}

#[test]
fn tiff_rejects_missing_zero_unsupported_or_truncated_entries() {
    assert_eq!(tiff_dimensions(&tiff(true, &[(256, 3, 10)])), None);
    assert_eq!(
        tiff_dimensions(&tiff(true, &[(256, 3, 0), (257, 3, 5)])),
        None
    );
    assert_eq!(
        tiff_dimensions(&tiff(true, &[(256, 5, 10), (257, 3, 5)])),
        None
    );
    let mut truncated = tiff(false, &[(256, 3, 10), (257, 3, 5)]);
    truncated.truncate(20);
    assert_eq!(tiff_dimensions(&truncated), None);
    assert_eq!(tiff_dimensions(b"XXXX"), None);
    assert_eq!(tiff_dimensions(b"II*"), None);
}
