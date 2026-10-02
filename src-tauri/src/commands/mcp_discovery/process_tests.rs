use super::{discover_mcp_tools, paths::node_program, process::discover_from_process_blocking};
use std::{fs, path::PathBuf, process::Command};

struct Fixture(PathBuf);
impl Fixture {
    fn new(script: &str) -> Self {
        let dir = std::env::temp_dir().join(format!("seomi-mcp-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&dir).unwrap();
        fs::write(dir.join("server.js"), script).unwrap();
        Self(dir)
    }
    fn path(&self) -> String {
        self.0.join("server.js").to_string_lossy().into_owned()
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

#[tokio::test]
async fn public_discovery_rejects_untrusted_paths_before_spawning() {
    for path in ["relative.js", "/definitely-missing/seomi-server.ts", ""] {
        assert!(discover_mcp_tools(path.into()).await.is_err());
    }
}

#[test]
fn real_node_discovery_preserves_server_identity_and_catalog() {
    let fixture = Fixture::new(
        r#"
process.stdin.resume();
console.log(JSON.stringify({id:1,result:{serverInfo:{name:'fixture',version:'1'}}}));
console.log(JSON.stringify({id:2,result:{tools:[{name:'test_tool',inputSchema:{type:'object'}}]}}));
setInterval(()=>{},1000);
"#,
    );
    let result = discover_from_process_blocking(fixture.path()).unwrap();
    assert_eq!(result.server_name, "fixture");
    assert_eq!(result.server_version, "1");
    assert_eq!(result.tools.len(), 1);
    assert_eq!(result.tools[0].name, "test_tool");
}

#[test]
fn malformed_output_returns_an_error_and_leaves_no_live_server() {
    let fixture = Fixture::new(
        r#"
require('fs').writeFileSync(require('path').join(__dirname,'pid'),String(process.pid));
process.stdin.resume(); console.log('not-json'); setInterval(()=>{},1000);
"#,
    );
    assert!(discover_from_process_blocking(fixture.path())
        .unwrap_err()
        .contains("non-JSON"));
    let pid = fs::read_to_string(fixture.0.join("pid")).unwrap();
    let alive = Command::new(node_program()).args(["-e",
        "try{process.kill(Number(process.argv[1]),0);process.kill(Number(process.argv[1]));process.exit(0)}catch{process.exit(1)}",
        &pid]).status().unwrap().success();
    assert!(
        !alive,
        "server survived error; fixture process has been cleaned up"
    );
}

#[test]
fn a_real_node_server_cannot_exceed_the_unterminated_line_budget() {
    let fixture = Fixture::new(
        r#"
process.stdin.resume(); process.stdout.write('x'.repeat(1048577)); setInterval(()=>{},1000);
"#,
    );
    assert!(discover_from_process_blocking(fixture.path())
        .unwrap_err()
        .contains("1 MiB"));
}
