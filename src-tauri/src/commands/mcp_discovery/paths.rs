use std::{env, path::Path};

pub(super) fn node_program() -> std::ffi::OsString {
    // Desktop shells launched from Finder/Start Menu often have a reduced PATH.
    // Prefer an explicit runtime path supplied by the host when it is present,
    // then keep the normal PATH lookup for installed Node.js distributions.
    for variable in ["SEOMI_NODE_PATH", "CODEX_MCP_NODE_PATH", "NODE"] {
        if let Some(candidate) = env::var_os(variable) {
            let path = Path::new(&candidate);
            if path.is_absolute() && path.is_file() {
                return candidate;
            }
        }
    }
    "node".into()
}

pub(super) fn validate_server_path(value: &str) -> Result<String, String> {
    let path = Path::new(value.trim());
    if !path.is_absolute() {
        return Err("Choose an absolute path to a trusted MCP server JavaScript file.".into());
    }
    if !path
        .extension()
        .is_some_and(|extension| extension.eq_ignore_ascii_case("js"))
    {
        return Err("The MCP server path must point to a .js file.".into());
    }
    let canonical = path.canonicalize().map_err(|_| {
        "The selected MCP server file does not exist or cannot be read.".to_string()
    })?;
    if !canonical.is_file() {
        return Err("The selected MCP server path is not a file.".into());
    }
    Ok(canonical.to_string_lossy().into_owned())
}
