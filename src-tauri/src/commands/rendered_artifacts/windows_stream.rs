#[cfg(target_os = "windows")]
pub(crate) fn read_com_stream(
    stream: &windows::Win32::System::Com::IStream,
) -> Result<Vec<u8>, String> {
    use windows::Win32::System::Com::STREAM_SEEK_SET;

    let mut position = 0u64;
    unsafe {
        stream
            .Seek(0, STREAM_SEEK_SET, Some(&mut position as *mut u64))
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
                Some(&mut read as *mut u32),
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

#[cfg(test)]
mod tests {
    use super::read_com_stream;
    use windows::{
        core::Result,
        Win32::{
            Foundation::HGLOBAL, System::Com::StructuredStorage::CreateStreamOnHGlobal,
            UI::Shell::IStream_Write,
        },
    };

    fn empty_stream() -> Result<windows::Win32::System::Com::IStream> {
        unsafe { CreateStreamOnHGlobal(HGLOBAL(std::ptr::null_mut()), true) }
    }

    #[test]
    fn empty_stream_is_rejected() {
        let stream = empty_stream().expect("COM stream should be created");
        assert_eq!(
            read_com_stream(&stream).unwrap_err(),
            "WebView2 returned an empty screenshot."
        );
    }

    #[test]
    fn stream_bytes_are_read_after_windows_api_update() {
        let stream = empty_stream().expect("COM stream should be created");
        let payload = b"windows rendered artifact";
        unsafe {
            IStream_Write(&stream, payload.as_ptr().cast(), payload.len() as u32)
                .expect("COM stream write should succeed");
        }
        assert_eq!(read_com_stream(&stream).unwrap(), payload);
    }
}
