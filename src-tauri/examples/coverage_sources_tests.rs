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
