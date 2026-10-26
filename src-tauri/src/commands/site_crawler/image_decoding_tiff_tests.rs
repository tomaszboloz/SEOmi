use super::*;

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
