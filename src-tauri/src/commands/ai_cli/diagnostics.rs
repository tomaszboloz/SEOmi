pub(super) fn display_output(output: &std::process::Output) -> String {
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let (primary, secondary) = if output.status.success() {
        (&stdout, &stderr)
    } else {
        (&stderr, &stdout)
    };
    let line = primary
        .lines()
        .chain(secondary.lines())
        .map(|value| {
            value
                .chars()
                .filter(|character| !character.is_control())
                .collect::<String>()
        })
        .map(|value| value.trim().to_string())
        .find(|value| !value.is_empty())
        .unwrap_or_default();
    let mut detail = line
        .chars()
        .filter(|character| !character.is_control())
        .collect::<String>();
    if detail.chars().count() > 240 {
        detail = detail.chars().take(237).collect::<String>() + "...";
    }
    detail
}

pub(super) fn output_text(output: &std::process::Output) -> String {
    let mut text = format!(
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    )
    .chars()
    .filter(|character| !character.is_control() || *character == '\n')
    .collect::<String>();
    if text.chars().count() > 2_000 {
        text = text.chars().take(1_997).collect::<String>() + "...";
    }
    text
}

pub(super) fn output_text_full(output: &std::process::Output) -> String {
    format!(
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    )
}

pub(super) fn cli_response(command: &str, output: &std::process::Output) -> Result<String, String> {
    if !output.status.success() {
        let stderr = display_output(output);
        return Err(if stderr.is_empty() {
            format!("{} exited with {}.", command, output.status)
        } else {
            stderr
        });
    }
    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if text.is_empty() {
        return Err(format!("{} returned no response.", command));
    }
    Ok(text)
}
