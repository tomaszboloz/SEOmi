use super::discover_mcp_tools;
use std::{fs, path::PathBuf};

struct Fixture(PathBuf);

impl Fixture {
    fn new() -> Self {
        let directory =
            std::env::temp_dir().join(format!("seomi-mcp-public-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&directory).unwrap();
        fs::write(
            directory.join("server.js"),
            r#"const readline = require('readline');
const input = readline.createInterface({ input: process.stdin });
input.on('line', line => {
  let request;
  try { request = JSON.parse(line); } catch { return; }
  if (request.id === 1 && request.method === 'initialize') {
    process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:1,result:{serverInfo:{name:'public-fixture',version:'2'}}}) + '\n');
  } else if (request.id === 2 && request.method === 'tools/list') {
    process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:2,result:{tools:[{name:'public_tool',inputSchema:{type:'object'}}]}}) + '\n');
  }
});
setInterval(()=>{},1000);"#,
        )
        .unwrap();
        Self(directory)
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
async fn public_discovery_runs_path_validation_and_returns_a_real_catalog() {
    let fixture = Fixture::new();
    let discovery = discover_mcp_tools(fixture.path()).await.unwrap();
    assert_eq!(discovery.server_name, "public-fixture");
    assert_eq!(discovery.server_version, "2");
    assert_eq!(discovery.tools.len(), 1);
    assert_eq!(discovery.tools[0].name, "public_tool");
}
