pub(super) fn read_be_u16(bytes: &[u8], offset: usize) -> Option<usize> {
    Some(u16::from_be_bytes([*bytes.get(offset)?, *bytes.get(offset + 1)?]) as usize)
}

pub(super) fn read_be_u32(bytes: &[u8], offset: usize) -> Option<usize> {
    Some(u32::from_be_bytes([
        *bytes.get(offset)?,
        *bytes.get(offset + 1)?,
        *bytes.get(offset + 2)?,
        *bytes.get(offset + 3)?,
    ]) as usize)
}

pub(super) fn read_le_u16(bytes: &[u8], offset: usize) -> Option<usize> {
    Some(u16::from_le_bytes([*bytes.get(offset)?, *bytes.get(offset + 1)?]) as usize)
}

pub(super) fn read_le_u24(bytes: &[u8], offset: usize) -> Option<usize> {
    Some(
        (*bytes.get(offset)? as usize)
            | ((*bytes.get(offset + 1)? as usize) << 8)
            | ((*bytes.get(offset + 2)? as usize) << 16),
    )
}
