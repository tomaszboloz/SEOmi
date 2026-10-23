use super::*;

fn le_u32(bytes: &[u8], offset: usize) -> Option<usize> {
    Some(u32::from_le_bytes([
        *bytes.get(offset)?,
        *bytes.get(offset + 1)?,
        *bytes.get(offset + 2)?,
        *bytes.get(offset + 3)?,
    ]) as usize)
}

fn nonzero(dimensions: (usize, usize)) -> Option<(usize, usize)> {
    (dimensions.0 > 0 && dimensions.1 > 0).then_some(dimensions)
}

/// Lossy (`VP8 `) and lossless (`VP8L`) WebP; `VP8X` is handled by the caller.
fn webp_dimensions(bytes: &[u8]) -> Option<(usize, usize)> {
    if bytes.get(0..4) != Some(b"RIFF") || bytes.get(8..12) != Some(b"WEBP") {
        return None;
    }
    match bytes.get(12..16)? {
        b"VP8 " if bytes.get(23..26) == Some(&[0x9d, 0x01, 0x2a]) => nonzero((
            read_le_u16(bytes, 26)? & 0x3fff,
            read_le_u16(bytes, 28)? & 0x3fff,
        )),
        b"VP8L" if bytes.get(20) == Some(&0x2f) => {
            let (b0, b1, b2, b3) = (
                *bytes.get(21)? as usize,
                *bytes.get(22)? as usize,
                *bytes.get(23)? as usize,
                *bytes.get(24)? as usize,
            );
            Some((
                (b0 | ((b1 & 0x3f) << 8)) + 1,
                ((b1 >> 6) | (b2 << 2) | ((b3 & 0x0f) << 10)) + 1,
            ))
        }
        _ => None,
    }
}

/// AVIF/HEIF: largest `ispe` (image spatial extents) property in the bounded prefix.
fn avif_dimensions(bytes: &[u8]) -> Option<(usize, usize)> {
    let brand = bytes.get(8..12)?;
    if bytes.get(4..8) != Some(b"ftyp")
        || !matches!(brand, b"avif" | b"avis" | b"heic" | b"heix" | b"mif1")
    {
        return None;
    }
    let mut largest: Option<(usize, usize)> = None;
    for position in 0..bytes.len().saturating_sub(16) {
        if bytes.get(position..position + 4) != Some(b"ispe") {
            continue;
        }
        let width = read_be_u32(bytes, position + 8)?;
        let height = read_be_u32(bytes, position + 12)?;
        if nonzero((width, height)).is_some()
            && largest.map_or(true, |(w, h)| {
                width.saturating_mul(height) > w.saturating_mul(h)
            })
        {
            largest = Some((width, height));
        }
    }
    largest
}

/// Windows BMP: BITMAPCOREHEADER (12 bytes) or BITMAPINFOHEADER and later; height may be negative.
fn bmp_dimensions(bytes: &[u8]) -> Option<(usize, usize)> {
    if bytes.get(0..2) != Some(b"BM") {
        return None;
    }
    if le_u32(bytes, 14)? == 12 {
        return nonzero((read_le_u16(bytes, 18)?, read_le_u16(bytes, 20)?));
    }
    let width = le_u32(bytes, 18)? as u32 as i32;
    let height = le_u32(bytes, 22)? as u32 as i32;
    nonzero((
        width.unsigned_abs() as usize,
        height.unsigned_abs() as usize,
    ))
}

/// Fallback decoders for formats the primary decoder does not recognise.
pub(super) fn modern_image_dimensions(bytes: &[u8]) -> Option<(usize, usize)> {
    webp_dimensions(bytes)
        .or_else(|| avif_dimensions(bytes))
        .or_else(|| bmp_dimensions(bytes))
}

#[cfg(test)]
#[path = "image_decoding_modern_tests.rs"]
mod tests;
