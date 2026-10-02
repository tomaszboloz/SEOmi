use std::process::Stdio;
use tokio::{
    io::{AsyncRead, AsyncReadExt, AsyncWriteExt},
    process::Command,
};
pub(super) const MAX_CLI_OUTPUT_BYTES: usize = 2 * 1024 * 1024;

pub(super) async fn read_cli_stream<R: AsyncRead + Unpin>(
    mut stream: R,
    limit: usize,
) -> std::io::Result<Vec<u8>> {
    let mut output = Vec::new();
    let mut buffer = [0; 8192];
    loop {
        let count = stream.read(&mut buffer).await?;
        if count == 0 {
            return Ok(output);
        }
        if count > limit.saturating_sub(output.len()) {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "CLI output limit exceeded",
            ));
        }
        output.extend_from_slice(&buffer[..count]);
    }
}

pub(super) async fn bounded_process_output(
    mut process: Command,
    prompt: &str,
) -> std::io::Result<std::process::Output> {
    process
        .kill_on_drop(true)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = process.spawn()?;
    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| std::io::Error::other("Missing CLI stdin"))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| std::io::Error::other("Missing CLI stdout"))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| std::io::Error::other("Missing CLI stderr"))?;
    // Drain both pipes while writing input: providers may emit output before
    // consuming the prompt. try_join cancels on overflow; child drop kills it.
    let (_, stdout, stderr, status) = tokio::try_join!(
        async {
            stdin.write_all(prompt.as_bytes()).await?;
            drop(stdin);
            Ok::<(), std::io::Error>(())
        },
        read_cli_stream(stdout, MAX_CLI_OUTPUT_BYTES),
        read_cli_stream(stderr, MAX_CLI_OUTPUT_BYTES),
        child.wait(),
    )?;
    Ok(std::process::Output {
        status,
        stdout,
        stderr,
    })
}
