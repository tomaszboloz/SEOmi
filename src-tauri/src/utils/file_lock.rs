use std::{
    fs::{File, OpenOptions},
    io,
    path::Path,
};

pub(crate) struct FileLock {
    _file: File,
}

impl Drop for FileLock {
    fn drop(&mut self) {
        // A concurrently spawned Unix child can briefly inherit the open file
        // description before exec. Release ownership explicitly for this owner
        // rather than waiting for the last inherited descriptor to close.
        let _ = fs2::FileExt::unlock(&self._file);
    }
}

/// Keep one stable inode for the lock. Never unlink it on drop: a waiter could
/// already hold that inode while another process creates a replacement path.
/// The OS releases exclusivity when this file closes or the process exits.
pub(crate) fn acquire_file_lock(path: &Path) -> io::Result<Option<FileLock>> {
    let file = open_lock_file(path)?;
    match fs2::FileExt::try_lock_exclusive(&file) {
        Ok(()) => Ok(Some(FileLock { _file: file })),
        Err(error) if error.raw_os_error() == fs2::lock_contended_error().raw_os_error() => {
            Ok(None)
        }
        Err(error) => Err(error),
    }
}

pub(crate) fn lock_file(path: &Path) -> io::Result<FileLock> {
    let file = open_lock_file(path)?;
    fs2::FileExt::lock_exclusive(&file)?;
    Ok(FileLock { _file: file })
}

fn open_lock_file(path: &Path) -> io::Result<File> {
    OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(path)
}

#[cfg(test)]
mod tests;

#[cfg(test)]
mod process_tests;
