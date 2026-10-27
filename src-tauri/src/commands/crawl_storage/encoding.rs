use flate2::{read::GzDecoder, write::GzEncoder, Compression};
use serde_json::Value;
use std::io::{Read, Write};

pub(crate) const STORAGE_MAGIC: &[u8] = b"SEOMI-CRAWL-GZIP-V1\n";
pub(crate) const MAX_STORED_BYTES: usize = 512 * 1024 * 1024;
pub(crate) const MAX_EXPANDED_BYTES: u64 = 2 * 1024 * 1024 * 1024;

pub(crate) fn validate_storage_size(stored_len: u64, compressed: bool) -> Result<(), String> {
    validate_storage_size_with_limits(stored_len, compressed, MAX_STORED_BYTES, MAX_EXPANDED_BYTES)
}

pub(crate) fn validate_storage_size_with_limits(
    stored_len: u64,
    compressed: bool,
    max_stored_bytes: usize,
    max_expanded_bytes: u64,
) -> Result<(), String> {
    let limit = if compressed {
        (max_stored_bytes + STORAGE_MAGIC.len()) as u64
    } else {
        max_expanded_bytes
    };
    if stored_len > limit {
        // The frontend maps this stable quota marker to the active locale and
        // platform-specific recovery guidance.
        return Err("Crawl history storage quota exceeded.".into());
    }
    Ok(())
}

pub(crate) fn encode_crawl_runs(crawl_runs: &Value) -> Result<Vec<u8>, String> {
    encode_crawl_runs_with_limit(crawl_runs, MAX_STORED_BYTES)
}

pub(crate) fn encode_crawl_runs_with_limit(
    crawl_runs: &Value,
    max_stored_bytes: usize,
) -> Result<Vec<u8>, String> {
    let compressed = compress_crawl_runs(crawl_runs, Vec::new())?;
    if compressed.len() > max_stored_bytes {
        return Err("Skrośna historia crawla nadal przekracza limit 512 MiB po kompresji. Zmniejsz limit stron lub usuń starsze runy.".into());
    }
    let mut bytes = Vec::with_capacity(STORAGE_MAGIC.len() + compressed.len());
    bytes.extend_from_slice(STORAGE_MAGIC);
    bytes.extend_from_slice(&compressed);
    Ok(bytes)
}

pub(crate) fn compress_crawl_runs<W: Write>(crawl_runs: &Value, writer: W) -> Result<W, String> {
    compress_crawl_runs_with_finish(crawl_runs, writer, |encoder| encoder.finish())
}

pub(crate) fn compress_crawl_runs_with_finish<W, Finish>(
    crawl_runs: &Value,
    writer: W,
    finish: Finish,
) -> Result<W, String>
where
    W: Write,
    Finish: FnOnce(GzEncoder<W>) -> std::io::Result<W>,
{
    let mut encoder = GzEncoder::new(writer, Compression::default());
    serde_json::to_writer(&mut encoder, crawl_runs)
        .map_err(|error| format!("Unable to serialize crawl runs: {error}"))?;
    finish(encoder).map_err(|error| format!("Unable to compress crawl history: {error}"))
}

pub(crate) fn decode_crawl_runs(bytes: &[u8]) -> Result<Value, String> {
    decode_crawl_runs_with_limits(bytes, MAX_STORED_BYTES, MAX_EXPANDED_BYTES)
}

pub(crate) fn decode_crawl_runs_with_limits(
    bytes: &[u8],
    max_stored_bytes: usize,
    max_expanded_bytes: u64,
) -> Result<Value, String> {
    if let Some(compressed) = bytes.strip_prefix(STORAGE_MAGIC) {
        validate_storage_size_with_limits(
            bytes.len() as u64,
            true,
            max_stored_bytes,
            max_expanded_bytes,
        )?;
        let decoder = GzDecoder::new(compressed);
        let mut expanded = Vec::new();
        decoder
            .take(max_expanded_bytes + 1)
            .read_to_end(&mut expanded)
            .map_err(|error| format!("Saved compressed crawl data is invalid: {error}"))?;
        if expanded.len() as u64 > max_expanded_bytes {
            return Err("Crawl history storage quota exceeded.".into());
        }
        return serde_json::from_slice(&expanded)
            .map_err(|error| format!("Saved crawl data is invalid: {error}"));
    }
    // Read histories produced by earlier releases before compressed storage.
    validate_storage_size_with_limits(
        bytes.len() as u64,
        false,
        max_stored_bytes,
        max_expanded_bytes,
    )?;
    serde_json::from_slice(bytes).map_err(|error| format!("Saved crawl data is invalid: {error}"))
}
