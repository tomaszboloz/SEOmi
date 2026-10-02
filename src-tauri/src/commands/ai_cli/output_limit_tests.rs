use super::tests::{collect_fixture_output, fixture_process};
use std::time::Duration;

// Write raw bytes once: PowerShell TextWriter can spend the deadline encoding
// millions of characters instead of exercising the production pipe limit.
#[tokio::test]
async fn excessive_stdout_or_stderr_fails_without_truncating_an_answer() {
    for stderr in [false, true] {
        let unix = if stderr {
            "awk 'BEGIN { for(i=0;i<2097153;i++) printf \"x\" }' >&2"
        } else {
            "awk 'BEGIN { for(i=0;i<2097153;i++) printf \"x\" }'"
        };
        let windows = if stderr {
            "$bytes = [Text.Encoding]::ASCII.GetBytes('x' * 2097153); [Console]::OpenStandardError().Write($bytes, 0, $bytes.Length)"
        } else {
            "$bytes = [Text.Encoding]::ASCII.GetBytes('x' * 2097153); [Console]::OpenStandardOutput().Write($bytes, 0, $bytes.Length)"
        };
        let error =
            collect_fixture_output(fixture_process(unix, windows), "", Duration::from_secs(10))
                .await
                .unwrap_err();
        assert!(error.contains("output limit"), "{error}");
    }
}

#[tokio::test]
async fn exact_production_stream_limit_preserves_every_byte() {
    for stderr in [false, true] {
        let unix = if stderr {
            "awk 'BEGIN { for(i=0;i<2097152;i++) printf \"x\" }' >&2"
        } else {
            "awk 'BEGIN { for(i=0;i<2097152;i++) printf \"x\" }'"
        };
        let windows = if stderr {
            "$bytes = [Text.Encoding]::ASCII.GetBytes('x' * 2097152); [Console]::OpenStandardError().Write($bytes, 0, $bytes.Length)"
        } else {
            "$bytes = [Text.Encoding]::ASCII.GetBytes('x' * 2097152); [Console]::OpenStandardOutput().Write($bytes, 0, $bytes.Length)"
        };
        let output =
            collect_fixture_output(fixture_process(unix, windows), "", Duration::from_secs(10))
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
