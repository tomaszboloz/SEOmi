use super::super::process::{ProcessResult, ProcessRunner};
use std::{cell::RefCell, fs, io, path::{Path, PathBuf}};

pub(super) struct FakeRunner {
    pub(super) uid: &'static str,
    pub(super) uid_success: bool,
    pub(super) uid_error: Option<&'static str>,
    pub(super) bootstrap: Result<bool, &'static str>,
    pub(super) bootout: Result<bool, &'static str>,
    pub(super) calls: RefCell<Vec<(String, Vec<String>)>>,
}

impl FakeRunner {
    pub(super) fn new(uid: &'static str, uid_success: bool, bootstrap: Result<bool, &'static str>) -> Self {
        Self {
            uid,
            uid_success,
            uid_error: None,
            bootstrap,
            bootout: Ok(true),
            calls: RefCell::new(Vec::new()),
        }
    }
}

impl ProcessRunner for FakeRunner {
    fn output(&self, program: &str, args: &[String]) -> io::Result<ProcessResult> {
        self.calls.borrow_mut().push((program.into(), args.into()));
        if let Some(error) = self.uid_error {
            return Err(io::Error::other(error));
        }
        Ok(ProcessResult { success: self.uid_success, stdout: self.uid.as_bytes().into() })
    }

    fn status(&self, program: &str, args: &[String]) -> io::Result<bool> {
        self.calls.borrow_mut().push((program.into(), args.into()));
        match args.first().map(String::as_str) {
            Some("bootstrap") => self.bootstrap.map_err(io::Error::other),
            Some("bootout") => self.bootout.map_err(io::Error::other),
            _ => panic!("unexpected process arguments"),
        }
    }
}

pub(super) fn home() -> PathBuf {
    let path = std::env::temp_dir().join(format!("seomi-scheduler-{}", uuid::Uuid::new_v4()));
    fs::create_dir(&path).unwrap();
    path
}

pub(super) fn executable() -> &'static Path {
    Path::new("/Applications/SEOmi.app/Contents/MacOS/seomi")
}
