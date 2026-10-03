use super::collector::collect;
use super::types::Function;

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
