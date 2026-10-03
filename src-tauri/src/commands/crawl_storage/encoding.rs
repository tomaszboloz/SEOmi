use flate2::{read::GzDecoder, write::GzEncoder, Compression};
use serde_json::Value;
use std::io::Read;

pub(crate) const STORAGE_MAGIC: &[u8] = b"SEOMI-CRAWL-GZIP-V1\n";
pub(crate) const MAX_STORED_BYTES: usize = 512 * 1024 * 1024;
pub(crate) const MAX_EXPANDED_BYTES: u64 = 2 * 1024 * 1024 * 1024;

pub(crate) fn validate_storage_size(stored_len: u64, compressed: bool) -> Result<(), String> {
    let limit = if compressed {
        (MAX_STORED_BYTES + STORAGE_MAGIC.len()) as u64
    } else {
        MAX_EXPANDED_BYTES
    };
    if stored_len > limit {
        // The frontend maps this stable quota marker to the active locale and
        // platform-specific recovery guidance.
        return Err("Crawl history storage quota exceeded.".into());
    }
    Ok(())
}

pub(crate) fn encode_crawl_runs(crawl_runs: &Value) -> Result<Vec<u8>, String> {
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    serde_json::to_writer(&mut encoder, crawl_runs)
        .map_err(|error| format!("Unable to serialize crawl runs: {error}"))?;
    let compressed = encoder
        .finish()
        .map_err(|error| format!("Unable to compress crawl history: {error}"))?;
    if compressed.len() > MAX_STORED_BYTES {
        return Err("Skrośna historia crawla nadal przekracza limit 512 MiB po kompresji. Zmniejsz limit stron lub usuń starsze runy.".into());
    }
    let mut bytes = Vec::with_capacity(STORAGE_MAGIC.len() + compressed.len());
    bytes.extend_from_slice(STORAGE_MAGIC);
    bytes.extend_from_slice(&compressed);
    Ok(bytes)
}

pub(crate) fn decode_crawl_runs(bytes: &[u8]) -> Result<Value, String> {
    if let Some(compressed) = bytes.strip_prefix(STORAGE_MAGIC) {
        validate_storage_size(bytes.len() as u64, true)?;
        let decoder = GzDecoder::new(compressed);
        let mut expanded = Vec::new();
        decoder
            .take(MAX_EXPANDED_BYTES + 1)
            .read_to_end(&mut expanded)
            .map_err(|error| format!("Saved compressed crawl data is invalid: {error}"))?;
        if expanded.len() as u64 > MAX_EXPANDED_BYTES {
            return Err("Crawl history storage quota exceeded.".into());
        }
        return serde_json::from_slice(&expanded)
            .map_err(|error| format!("Saved crawl data is invalid: {error}"));
    }
    // Read histories produced by earlier releases before compressed storage.
    validate_storage_size(bytes.len() as u64, false)?;
    serde_json::from_slice(bytes).map_err(|error| format!("Saved crawl data is invalid: {error}"))
}
