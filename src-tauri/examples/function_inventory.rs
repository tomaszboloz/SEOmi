//! AST inventory; visibility is declared visibility, not a guessed export graph.
use serde::Serialize;
use std::{fs, path::Path};
use syn::spanned::Spanned;

#[derive(Debug, Serialize)]
struct Function {
    file: String,
    name: String,
    namespace: String,
    visibility: String,
    line: usize,
    body_line: usize,
    end_line: usize,
    conditional: bool,
}

fn test_only(attributes: &[syn::Attribute]) -> bool {
    attributes.iter().any(|attribute| {
        attribute.path().is_ident("test")
            || (attribute.path().is_ident("cfg")
                && attribute
                    .meta
                    .require_list()
                    .is_ok_and(|list| list.tokens.to_string() == "test"))
    })
}

fn visibility(value: &syn::Visibility) -> Option<&'static str> {
    match value {
        syn::Visibility::Public(_) => Some("declared-public"),
        syn::Visibility::Restricted(_) => Some("restricted"),
        syn::Visibility::Inherited => None,
    }
}

fn add(
    file: &str,
    namespace: &str,
    signature: &syn::Signature,
    body: &syn::Block,
    visibility: &str,
    conditional: bool,
    output: &mut Vec<Function>,
) {
    output.push(Function {
        file: file.into(),
        name: signature.ident.to_string(),
        namespace: namespace.into(),
        visibility: visibility.into(),
        line: signature.span().start().line,
        body_line: body.span().start().line,
        end_line: body.span().end().line,
        conditional,
    });
}

fn collect(
    file: &str,
    namespace: &str,
    items: &[syn::Item],
    inherited_condition: bool,
    output: &mut Vec<Function>,
) {
    for item in items {
        match item {
            syn::Item::Fn(function) if !test_only(&function.attrs) => {
                if let Some(visibility) = visibility(&function.vis) {
                    add(
                        file,
                        namespace,
                        &function.sig,
                        &function.block,
                        visibility,
                        inherited_condition
                            || function
                                .attrs
                                .iter()
                                .any(|attr| attr.path().is_ident("cfg")),
                        output,
                    );
                }
            }
            syn::Item::Mod(module) if !test_only(&module.attrs) => {
                if let Some((_, items)) = &module.content {
                    collect(
                        file,
                        &format!("{namespace}::{}", module.ident),
                        items,
                        inherited_condition
                            || module.attrs.iter().any(|attr| attr.path().is_ident("cfg")),
                        output,
                    );
                }
            }
            syn::Item::Impl(implementation) if !test_only(&implementation.attrs) => {
                for item in &implementation.items {
                    if let syn::ImplItem::Fn(function) = item {
                        if test_only(&function.attrs) {
                            continue;
                        }
                        let visibility = visibility(&function.vis).or_else(|| {
                            implementation
                                .trait_
                                .as_ref()
                                .map(|_| "trait-implementation")
                        });
                        if let Some(visibility) = visibility {
                            add(
                                file,
                                &format!(
                                    "{namespace}::impl@{}",
                                    implementation.span().start().line
                                ),
                                &function.sig,
                                &function.block,
                                visibility,
                                inherited_condition
                                    || implementation
                                        .attrs
                                        .iter()
                                        .chain(&function.attrs)
                                        .any(|attr| attr.path().is_ident("cfg")),
                                output,
                            );
                        }
                    }
                }
            }
            syn::Item::Trait(item) if !test_only(&item.attrs) => {
                for member in &item.items {
                    if let syn::TraitItem::Fn(function) = member {
                        if test_only(&function.attrs) {
                            continue;
                        }
                        if let Some(body) = &function.default {
                            add(
                                file,
                                &format!("{namespace}::{}", item.ident),
                                &function.sig,
                                body,
                                "trait-default",
                                inherited_condition
                                    || item
                                        .attrs
                                        .iter()
                                        .chain(&function.attrs)
                                        .any(|attr| attr.path().is_ident("cfg")),
                                output,
                            );
                        }
                    }
                }
            }
            _ => {}
        }
    }
}

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
mod tests {
    use super::*;
    fn parse(source: &str) -> Vec<Function> {
        let mut output = Vec::new();
        collect(
            "fixture.rs",
            "crate",
            &syn::parse_file(source).unwrap().items,
            false,
            &mut output,
        );
        output
    }
    #[test]
    fn ignores_comments_private_functions_and_test_modules() {
        let rows = parse("// pub fn invented() {}\npub fn real() {} fn private() {} #[cfg(test)] mod tests { pub fn fixture() {} }");
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].name, "real");
        assert_eq!(rows[0].line, 2);
    }
    #[test]
    fn distinguishes_restricted_visibility_platforms_and_default_trait_methods() {
        let rows = parse("pub(crate) fn restricted() {} #[cfg(windows)] pub fn platform() {} pub trait Contract { fn implementation() {} fn declaration(); }");
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[0].visibility, "restricted");
        assert!(rows[1].conditional);
        assert_eq!(rows[2].visibility, "trait-default");
    }
    #[test]
    fn finds_async_methods_nested_modules_and_trait_implementations() {
        let rows = parse("pub mod service { pub async fn run() {} } struct Client; impl Client { pub fn request() {} fn hidden() {} } impl Contract for Client { fn execute() {} }");
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[0].namespace, "crate::service");
        assert_eq!(rows[2].visibility, "trait-implementation");
        assert!(rows
            .iter()
            .all(|row| row.end_line >= row.body_line && row.body_line >= row.line));
    }
}
