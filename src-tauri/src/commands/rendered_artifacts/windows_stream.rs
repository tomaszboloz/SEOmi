#[cfg(target_os = "windows")]
pub(crate) fn read_com_stream(stream: &windows::Win32::System::Com::IStream) -> Result<Vec<u8>, String> {
    use windows::Win32::System::Com::STREAM_SEEK_SET;

    let mut position = 0u64;
    unsafe {
        stream
            .Seek(0, STREAM_SEEK_SET, Some(&mut position))
            .map_err(|error| format!("Unable to seek screenshot stream: {error}"))?;
    }
    let mut result = Vec::new();
    loop {
        let mut buffer = [0u8; 64 * 1024];
        let mut read = 0u32;
        let status = unsafe {
            stream.Read(
                buffer.as_mut_ptr().cast(),
                buffer.len() as u32,
                Some(&mut read),
            )
        };
        if status.is_err() {
            return Err(format!("Unable to read screenshot stream: {status:?}"));
        }
        if read == 0 {
            break;
        }
        result.extend_from_slice(&buffer[..read as usize]);
    }
    if result.is_empty() {
        return Err("WebView2 returned an empty screenshot.".into());
    }
    Ok(result)
}
