use super::{
    compress_crawl_runs, compress_crawl_runs_with_finish, decode_crawl_runs_with_limits,
    encode_crawl_runs, encode_crawl_runs_with_limit, MAX_STORED_BYTES, STORAGE_MAGIC,
};
use serde_json::json;
use std::io::{self, Write};

#[derive(Debug)]
struct RejectingWriter;

impl Write for RejectingWriter {
    fn write(&mut self, _bytes: &[u8]) -> io::Result<usize> {
        Err(io::Error::other("fixture write failure"))
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

#[test]
fn encoder_preserves_distinct_serialization_and_finish_errors() {
    let value = json!({"payload": "test"});
    let serialization = compress_crawl_runs(&value, RejectingWriter).unwrap_err();
    assert!(serialization.starts_with("Unable to serialize crawl runs:"));

    let finish = compress_crawl_runs_with_finish(&value, Vec::new(), |_| {
        Err(io::Error::other("fixture finish failure"))
    })
    .unwrap_err();
    assert!(finish.starts_with("Unable to compress crawl history:"));
}

#[test]
fn encoder_and_decoder_expose_quota_guards_with_small_test_limits() {
    let value = json!([{"id": "run"}]);
    let encoded = encode_crawl_runs(&value).unwrap();
    assert!(encode_crawl_runs_with_limit(&value, 0)
        .unwrap_err()
        .contains("przekracza limit"));
    assert_eq!(
        decode_crawl_runs_with_limits(&encoded, MAX_STORED_BYTES, 0).unwrap_err(),
        "Crawl history storage quota exceeded."
    );

    let legacy = b"[]";
    assert_eq!(
        decode_crawl_runs_with_limits(legacy, MAX_STORED_BYTES, 0).unwrap_err(),
        "Crawl history storage quota exceeded."
    );
    assert!(encoded.starts_with(STORAGE_MAGIC));
}
