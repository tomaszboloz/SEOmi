use std::{io, process::Command};

pub(super) struct ProcessResult {
    pub(super) success: bool,
    pub(super) stdout: Vec<u8>,
}

pub(super) trait ProcessRunner {
    fn output(&self, program: &str, args: &[String]) -> io::Result<ProcessResult>;
    fn status(&self, program: &str, args: &[String]) -> io::Result<bool>;
}

pub(super) struct SystemProcessRunner;

impl ProcessRunner for SystemProcessRunner {
    fn output(&self, program: &str, args: &[String]) -> io::Result<ProcessResult> {
        let output = Command::new(program).args(args).output()?;
        Ok(ProcessResult {
            success: output.status.success(),
            stdout: output.stdout,
        })
    }

    fn status(&self, program: &str, args: &[String]) -> io::Result<bool> {
        Command::new(program)
            .args(args)
            .status()
            .map(|status| status.success())
    }
}
