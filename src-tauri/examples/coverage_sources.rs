//! Source hashes and test-only ranges for production LCOV reporting.
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
};
use syn::spanned::Spanned;

#[derive(Default, Serialize)]
struct Source {
    sha256: String,
    production_reachable: bool,
    test_reachable: bool,
    test_ranges: Vec<(usize, usize)>,
}

fn test_only(attributes: &[syn::Attribute]) -> bool {
    attributes.iter().any(|attribute| {
        attribute
            .path()
            .segments
            .last()
            .is_some_and(|segment| segment.ident == "test")
            || (attribute.path().is_ident("cfg")
                && attribute
                    .meta
                    .require_list()
                    .is_ok_and(|list| list.tokens.to_string() == "test"))
    })
}

fn module_file(module: &syn::ItemMod, directory: &Path, attribute_directory: &Path) -> PathBuf {
    for attribute in &module.attrs {
        if attribute.path().is_ident("path") {
            if let syn::Meta::NameValue(value) = &attribute.meta {
                if let syn::Expr::Lit(value) = &value.value {
                    if let syn::Lit::Str(value) = &value.lit {
                        return attribute_directory.join(value.value());
                    }
                }
            }
        }
    }
    let flat = directory.join(format!("{}.rs", module.ident));
    if flat.exists() {
        flat
    } else {
        directory.join(module.ident.to_string()).join("mod.rs")
    }
}

fn walk_items(
    items: &[syn::Item],
    directory: &Path,
    attribute_directory: &Path,
    inherited_test: bool,
    ranges: &mut Vec<(usize, usize)>,
    files: &mut BTreeMap<String, Source>,
) {
    for item in items {
        match item {
            syn::Item::Mod(module) => {
                let excluded = inherited_test || test_only(&module.attrs);
                if excluded {
                    ranges.push((module.span().start().line, module.span().end().line));
                }
                if let Some((_, nested)) = &module.content {
                    walk_items(
                        nested,
                        &directory.join(module.ident.to_string()),
                        &directory.join(module.ident.to_string()),
                        excluded,
                        ranges,
                        files,
                    );
                } else {
                    walk_file(
                        &module_file(module, directory, attribute_directory),
                        excluded,
                        files,
                    );
                }
            }
            syn::Item::Fn(function) if test_only(&function.attrs) => {
                ranges.push((function.span().start().line, function.span().end().line));
            }
            _ => {}
        }
    }
}

fn walk_file(path: &Path, excluded: bool, files: &mut BTreeMap<String, Source>) {
    let name = path.to_string_lossy().replace('\\', "/");
    let entry = files.entry(name.clone()).or_default();
    if (excluded && entry.test_reachable) || (!excluded && entry.production_reachable) {
        return;
    }
    if excluded {
        entry.test_reachable = true;
    } else {
        entry.production_reachable = true;
    }
    let source =
        fs::read_to_string(path).unwrap_or_else(|error| panic!("{}: {error}", path.display()));
    entry.sha256 = format!("{:x}", Sha256::digest(source.as_bytes()));
    let syntax = syn::parse_file(&source).unwrap();
    let directory = if matches!(
        path.file_name().and_then(|name| name.to_str()),
        Some("lib.rs" | "main.rs" | "mod.rs")
    ) {
        path.parent().unwrap().to_owned()
    } else {
        path.with_extension("")
    };
    let mut ranges = Vec::new();
    // Only ranges syntactically marked as tests are removed from shared files.
    walk_items(
        &syntax.items,
        &directory,
        path.parent().unwrap(),
        excluded,
        &mut ranges,
        files,
    );
    files.get_mut(&name).unwrap().test_ranges = ranges;
}

fn main() {
    let mut files = BTreeMap::new();
    walk_file(Path::new("src-tauri/src/lib.rs"), false, &mut files);
    walk_file(Path::new("src-tauri/src/main.rs"), false, &mut files);
    println!("{}", serde_json::to_string_pretty(&files).unwrap());
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn does_not_exclude_production_from_a_comment_or_platform_condition() {
        let syntax = syn::parse_file("// #[cfg(test)]\npub fn real() {}\n#[cfg(windows)] fn platform() {}\n#[tokio::test] async fn unit() {}\n#[cfg(test)] mod tests { fn helper() {} }").unwrap();
        let mut ranges = Vec::new();
        walk_items(
            &syntax.items,
            Path::new("fixture"),
            Path::new("fixture"),
            false,
            &mut ranges,
            &mut BTreeMap::new(),
        );
        assert_eq!(ranges, vec![(4, 4), (5, 5)]);
    }

    #[test]
    fn resolves_module_files_using_the_rust_module_directory() {
        let item: syn::ItemMod =
            syn::parse_str("#[cfg(test)] #[path = \"site_crawler/tests.rs\"] mod tests;").unwrap();
        assert_eq!(
            module_file(
                &item,
                Path::new("src/commands/site_crawler"),
                Path::new("src/commands")
            ),
            PathBuf::from("src/commands/site_crawler/tests.rs")
        );
    }
}
