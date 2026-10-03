//! AST inventory; visibility is declared visibility, not a guessed export graph.
use std::{fs, path::Path};

#[path = "function_inventory_types.rs"]
mod types;

#[path = "function_inventory_collector.rs"]
mod collector;

use collector::collect;
use types::Function;

fn inventory(path: &Path, output: &mut Vec<Function>) {
    let mut entries: Vec<_> = fs::read_dir(path)
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .collect();
    entries.sort();
    for path in entries {
        if path.is_dir() {
            inventory(&path, output);
        } else if path.extension().is_some_and(|extension| extension == "rs") {
            let source = fs::read_to_string(&path).unwrap();
            let syntax = syn::parse_file(&source).unwrap();
            collect(
                &path.to_string_lossy().replace('\\', "/"),
                "crate",
                &syntax.items,
                false,
                output,
            );
        }
    }
}

fn main() {
    let mut output = Vec::new();
    inventory(Path::new("src-tauri/src"), &mut output);
    println!("{}", serde_json::to_string_pretty(&output).unwrap());
}

#[cfg(test)]
#[path = "function_inventory_tests.rs"]
mod tests;
