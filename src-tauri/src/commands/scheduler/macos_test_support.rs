use super::super::process::{ProcessResult, ProcessRunner};
use std::{cell::RefCell, io};

pub(super) struct FakeRunner {
    uid: &'static str,
    uid_success: bool,
    bootstrap: Result<bool, &'static str>,
    pub(super) calls: RefCell<Vec<(String, Vec<String>)>>,
}

impl FakeRunner {
    pub(super) fn new(
        uid: &'static str,
        uid_success: bool,
        bootstrap: Result<bool, &'static str>,
    ) -> Self {
        Self {
            uid,
            uid_success,
            bootstrap,
            calls: RefCell::new(Vec::new()),
        }
    }
}

impl ProcessRunner for FakeRunner {
    fn output(&self, program: &str, args: &[String]) -> io::Result<ProcessResult> {
        self.calls
            .borrow_mut()
            .push((program.into(), args.to_vec()));
        Ok(ProcessResult {
            success: self.uid_success,
            stdout: self.uid.as_bytes().into(),
        })
    }

    fn status(&self, program: &str, args: &[String]) -> io::Result<bool> {
        self.calls
            .borrow_mut()
            .push((program.into(), args.to_vec()));
        if args.first().map(String::as_str) == Some("bootstrap") {
            self.bootstrap.map_err(io::Error::other)
        } else {
            Ok(true)
        }
    }
}
