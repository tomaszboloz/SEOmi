pub(crate) fn format_capture_acknowledgement(
    nonce_json: &str,
    sequence: u64,
    index: usize,
) -> String {
    format!(
        "window.dispatchEvent(new CustomEvent('seomi-capture-ack', {{detail: {{nonce: {nonce_json}, sequence: {sequence}, index: {index}}}}}));"
    )
}
