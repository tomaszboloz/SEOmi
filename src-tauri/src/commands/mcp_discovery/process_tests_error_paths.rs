use super::process::{
    discover_from_process_blocking, discover_from_process_blocking_with_program,
    discover_from_process_with_worker, write_requests,
};
use std::{
    ffi::OsString,
    fs,
    io::{self, Write},
    path::PathBuf,
};

struct ScriptFixture(PathBuf);
impl ScriptFixture {
    fn new(script: &str) -> Self {
        let dir = std::env::temp_dir().join(format!("seomi-mcp-err-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("server.js"), script).unwrap();
        Self(dir)
    }
    fn path(&self) -> String {
        self.0.join("server.js").to_string_lossy().into_owned()
    }
}
impl Drop for ScriptFixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn info_fixture(info_json: &str) -> ScriptFixture {
    let script = format!(
        "process.stdin.resume(); console.log(JSON.stringify({{id:1,result:{{serverInfo:{info_json}}}}})); console.log(JSON.stringify({{id:2,result:{{tools:[]}}}})); setInterval(()=>{{}},1000);"
    );
    ScriptFixture::new(&script)
}

#[test]
fn process_spawn_failure_reports_missing_node() {
    let result = discover_from_process_blocking_with_program(
        "unused-server.js".into(),
        OsString::from("__seomi_missing_node__"),
    );
    assert_eq!(
        result.unwrap_err(),
        "Node.js was not found on PATH. Install Node.js and restart the desktop app."
    );
}

#[test]
fn write_error_reports_failure() {
    let result = write_requests(FailingWriter::Write);
    assert_eq!(
        result.unwrap_err(),
        "Could not write to the MCP server process."
    );
}

#[test]
fn flush_error_reports_failure() {
    let result = write_requests(FailingWriter::Flush);
    assert_eq!(
        result.unwrap_err(),
        "Could not flush the MCP server request."
    );
}

#[tokio::test]
async fn worker_panic_is_reported_as_unexpected_stop() {
    let err = discover_from_process_with_worker("unused-server.js".into(), |_| {
        panic!("simulated worker panic")
    })
    .await
    .unwrap_err();
    assert_eq!(err, "MCP discovery worker stopped unexpectedly.");
}

enum FailingWriter {
    Write,
    Flush,
}

impl Write for FailingWriter {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        match self {
            Self::Write => Err(io::Error::other("write failed")),
            Self::Flush => Ok(bytes.len()),
        }
    }

    fn flush(&mut self) -> io::Result<()> {
        match self {
            Self::Write => Ok(()),
            Self::Flush => Err(io::Error::other("flush failed")),
        }
    }
}

#[test]
fn response_without_server_name_field_is_rejected() {
    let fixture = info_fixture("{version:'1.0.0'}");
    assert_eq!(
        discover_from_process_blocking(fixture.path()).unwrap_err(),
        "MCP initialize response contained no server name."
    );
}

#[test]
fn response_with_non_string_server_name_is_rejected() {
    let fixture = info_fixture("{name:1234,version:'1.0.0'}");
    assert_eq!(
        discover_from_process_blocking(fixture.path()).unwrap_err(),
        "MCP initialize response contained no server name."
    );
}

#[test]
fn response_with_non_string_server_version_defaults_to_unknown() {
    let fixture = info_fixture("{name:'valid-server',version:123}");
    let result = discover_from_process_blocking(fixture.path()).unwrap();
    assert_eq!(result.server_name, "valid-server");
    assert_eq!(result.server_version, "unknown");
}
