use std::{
    io,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};

pub(crate) fn write_bytes_atomic(destination: &Path, bytes: &[u8]) -> Result<(), String> {
    use std::io::Write;
    let lock_path = destination.with_extension("json.write.lock");
    let _write_lock = crate::utils::file_lock::lock_file(&lock_path)
        .map_err(|error| format!("Unable to lock destination: {error}"))?;
    let temporary = destination.with_extension(format!("json.{}.tmp", uuid::Uuid::new_v4()));
    let mut file = std::fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&temporary)
        .map_err(|error| format!("Unable to create temporary file: {error}"))?;
    if let Err(error) = file.write_all(bytes) {
        drop(file);
        let _ = std::fs::remove_file(&temporary);
        return Err(format!("Unable to write temporary file: {error}"));
    }
    drop(file);
    if let Err(error) = replace_file(&temporary, destination) {
        let _ = std::fs::remove_file(&temporary);
        return Err(format!("Unable to finalize file: {error}"));
    }
    Ok(())
}

pub(crate) fn read_bytes_bounded(path: &Path, max_bytes: usize) -> io::Result<Vec<u8>> {
    use std::io::Read;
    let file = std::fs::File::open(path);
    #[cfg(windows)]
    let file = file.map_err(|error| {
        // Windows can report PATH_NOT_FOUND when an ancestor is a regular file.
        // Callers must not confuse broken storage with genuinely absent data.
        if error.kind() == io::ErrorKind::NotFound {
            for ancestor in path.ancestors().skip(1) {
                match std::fs::metadata(ancestor) {
                    Ok(metadata) if !metadata.is_dir() => {
                        return io::Error::new(
                            io::ErrorKind::InvalidData,
                            "Saved data parent is not a directory.",
                        );
                    }
                    Ok(_) => break,
                    Err(parent_error) if parent_error.kind() == io::ErrorKind::NotFound => {}
                    Err(parent_error) => return parent_error,
                }
            }
        }
        error
    });
    let file = file?;
    let mut bytes = Vec::new();
    file.take((max_bytes as u64).saturating_add(1))
        .read_to_end(&mut bytes)?;
    if bytes.len() > max_bytes {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Saved data exceeds the safety limit.",
        ));
    }
    Ok(bytes)
}

#[cfg(test)]
#[path = "fs_atomic_tests.rs"]
mod tests;

pub(crate) const MAX_CHECKPOINT_BYTES: usize = 32 * 1024 * 1024;

#[cfg(windows)]
pub(crate) fn replace_file(source: &Path, destination: &Path) -> io::Result<()> {
    use std::{iter, os::windows::ffi::OsStrExt};
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    let source_wide: Vec<u16> = source
        .as_os_str()
        .encode_wide()
        .chain(iter::once(0))
        .collect();
    let destination_wide: Vec<u16> = destination
        .as_os_str()
        .encode_wide()
        .chain(iter::once(0))
        .collect();
    let replaced = unsafe {
        MoveFileExW(
            source_wide.as_ptr(),
            destination_wide.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if replaced == 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(not(windows))]
pub(crate) fn replace_file(source: &Path, destination: &Path) -> io::Result<()> {
    std::fs::rename(source, destination)
}

pub(crate) fn project_directory<R: tauri::Runtime>(
    app: &AppHandle<R>,
    project_id: &str,
) -> Result<PathBuf, String> {
    if project_id.is_empty()
        || project_id.len() > 80
        || !project_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
    {
        return Err("Invalid project identifier for crawl storage.".into());
    }
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Unable to locate application data folder: {error}"))?
        .join("projects")
        .join(project_id))
}
