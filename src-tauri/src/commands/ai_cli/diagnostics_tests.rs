use super::diagnostics::{cli_response, display_output, output_text, output_text_full};

fn output(success: bool, stdout: &[u8], stderr: &[u8]) -> std::process::Output {
    #[cfg(unix)]
    let status = {
        use std::os::unix::process::ExitStatusExt;
        std::process::ExitStatus::from_raw(if success { 0 } else { 256 })
    };
    #[cfg(windows)]
    let status = {
        use std::os::windows::process::ExitStatusExt;
        std::process::ExitStatus::from_raw(if success { 0 } else { 1 })
    };
    std::process::Output {
        status,
        stdout: stdout.to_vec(),
        stderr: stderr.to_vec(),
    }
}

#[test]
fn diagnostics_use_exit_status_precedence_and_the_first_visible_line() {
    for (success, stdout, stderr, expected) in [
        (true, "version", "warning", "version"),
        (false, "version", "failure", "failure"),
        (true, " \n\0\n", "fallback", "fallback"),
        (false, "fallback", "\0\n", "fallback"),
        (true, "\0", "\0", ""),
    ] {
        assert_eq!(
            display_output(&output(success, stdout.as_bytes(), stderr.as_bytes())),
            expected
        );
    }
}

#[test]
fn diagnostic_limits_count_unicode_characters_and_preserve_exact_boundaries() {
    assert_eq!(
        display_output(&output(true, "ż".repeat(240).as_bytes(), b"")),
        "ż".repeat(240)
    );
    assert_eq!(
        display_output(&output(true, "ż".repeat(241).as_bytes(), b"")),
        "ż".repeat(237) + "..."
    );
    assert_eq!(
        output_text(&output(true, "ż".repeat(1999).as_bytes(), b"")),
        "ż".repeat(1999) + "\n"
    );
    assert_eq!(
        output_text(&output(true, "ż".repeat(2000).as_bytes(), b"")),
        "ż".repeat(1997) + "..."
    );
}

#[test]
fn protocol_text_and_full_help_have_distinct_control_and_length_contracts() {
    let value = output(true, b"a\0b\n", b"\tx\n");
    assert_eq!(output_text(&value), "ab\n\nx\n");
    assert_eq!(output_text_full(&value), "a\0b\n\n\tx\n");
    assert_eq!(
        output_text_full(&output(true, "ż".repeat(3000).as_bytes(), b"")),
        "ż".repeat(3000) + "\n"
    );
}

#[test]
fn answers_are_complete_and_failures_never_accept_stdout_as_success() {
    assert_eq!(
        cli_response("fixture", &output(true, b"  full\nanswer  ", b"warning")).unwrap(),
        "full\nanswer"
    );
    assert!(cli_response("fixture", &output(true, b" \n ", b"warning"))
        .unwrap_err()
        .contains("no response"));
    assert_eq!(
        cli_response("fixture", &output(false, b"answer", b"failure")).unwrap_err(),
        "failure"
    );
    assert!(cli_response("fixture", &output(false, b"", b""))
        .unwrap_err()
        .contains("exited"));
}
