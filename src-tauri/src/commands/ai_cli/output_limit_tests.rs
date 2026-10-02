use super::tests::binary_fixture::collect_bytes_output_on_stream;
use std::time::Duration;

// Prewrite raw bytes outside the deadline. A native file reader exercises the
// actual production pipes without PowerShell startup or text encoding costs.
#[tokio::test]
async fn excessive_stdout_or_stderr_fails_without_truncating_an_answer() {
    assert_eq!(super::MAX_CLI_OUTPUT_BYTES, 2_097_152);
    let bytes = vec![b'x'; 2_097_153];
    for stderr in [false, true] {
        let error = collect_bytes_output_on_stream(&bytes, stderr, Duration::from_secs(10))
            .await
            .unwrap_err();
        assert!(error.contains("output limit"), "{error}");
    }
}

#[tokio::test]
async fn exact_production_stream_limit_preserves_every_byte() {
    assert_eq!(super::MAX_CLI_OUTPUT_BYTES, 2_097_152);
    let bytes = vec![b'x'; 2_097_152];
    for stderr in [false, true] {
        let output = collect_bytes_output_on_stream(&bytes, stderr, Duration::from_secs(10))
            .await
            .unwrap();
        assert!(output.status.success());
        let (stream, other) = if stderr {
            (&output.stderr, &output.stdout)
        } else {
            (&output.stdout, &output.stderr)
        };
        assert_eq!(stream.len(), super::MAX_CLI_OUTPUT_BYTES);
        assert!(stream.iter().all(|byte| *byte == b'x'));
        assert!(other.is_empty());
    }
}
