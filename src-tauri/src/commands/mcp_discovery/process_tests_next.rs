use super::process::discover_from_process_blocking;
use std::{fs, path::PathBuf};

struct NodeFixture(PathBuf);

impl NodeFixture {
    fn new(script: &str) -> Self {
        let dir = std::env::temp_dir().join(format!("seomi-mcp-next-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&dir).unwrap();
        fs::write(dir.join("server.js"), script).unwrap();
        Self(dir)
    }

    fn path(&self) -> String {
        self.0.join("server.js").to_string_lossy().into_owned()
    }
}

impl Drop for NodeFixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn responding_fixture(server_info: &str) -> NodeFixture {
    let script = r#"
process.stdin.resume();
console.log(JSON.stringify({id:1,result:{serverInfo:__SERVER_INFO__}}));
console.log(JSON.stringify({id:2,result:{tools:[]}}));
setInterval(()=>{},1000);
"#
    .replace("__SERVER_INFO__", server_info);
    NodeFixture::new(&script)
}

#[test]
fn initialize_without_server_info_is_rejected() {
    let fixture = NodeFixture::new(
        r#"
process.stdin.resume();
console.log(JSON.stringify({id:1,result:{}}));
console.log(JSON.stringify({id:2,result:{tools:[]}}));
setInterval(()=>{},1000);
"#,
    );
    assert_eq!(
        discover_from_process_blocking(fixture.path()).unwrap_err(),
        "MCP initialize response did not identify the server."
    );
}

#[test]
fn initialize_with_blank_server_name_is_rejected() {
    let fixture = responding_fixture("{name:'   ',version:'1'}");
    assert_eq!(
        discover_from_process_blocking(fixture.path()).unwrap_err(),
        "MCP initialize response contained no server name."
    );
}

#[test]
fn missing_server_version_is_reported_as_unknown() {
    let fixture = responding_fixture("{name:'fixture'}");
    let result = discover_from_process_blocking(fixture.path()).unwrap();
    assert_eq!(result.server_name, "fixture");
    assert_eq!(result.server_version, "unknown");
    assert!(result.tools.is_empty());
}

#[test]
fn real_node_exit_without_a_response_returns_immediately() {
    let fixture = NodeFixture::new("process.stdin.on('data', () => process.exit(0));");
    assert_eq!(
        discover_from_process_blocking(fixture.path()).unwrap_err(),
        "MCP server did not answer within the discovery timeout."
    );
}

#[test]
fn long_server_name_and_version_are_bounded() {
    let long_name = "n".repeat(200);
    let long_ver = "v".repeat(100);
    let fixture = responding_fixture(&format!("{{name:'{long_name}',version:'{long_ver}'}}"));
    let result = discover_from_process_blocking(fixture.path()).unwrap();
    assert_eq!(result.server_name.len(), 128);
    assert_eq!(result.server_version.len(), 64);
}

#[tokio::test]
async fn async_discover_from_process_succeeds_and_truncates() {
    let fixture = responding_fixture("{name:'async-fixture',version:'1.2.3'}");
    let result = super::process::discover_from_process(fixture.path())
        .await
        .unwrap();
    assert_eq!(result.server_name, "async-fixture");
    assert_eq!(result.server_version, "1.2.3");
}

#[test]
fn tools_list_error_returns_failure() {
    let script = r#"
process.stdin.resume();
console.log(JSON.stringify({id:1,result:{serverInfo:{name:'fixture',version:'1'}}}));
console.log(JSON.stringify({id:2,error:{code:-32601,message:'Method not found'}}));
setInterval(()=>{},1000);
"#;
    let fixture = NodeFixture::new(script);
    let err = discover_from_process_blocking(fixture.path()).unwrap_err();
    assert!(!err.is_empty());
}
