use super::types::{add, test_only, visibility, Function};
use syn::spanned::Spanned;

pub(crate) fn collect(
    file: &str,
    namespace: &str,
    items: &[syn::Item],
    inherited_condition: bool,
    output: &mut Vec<Function>,
) {
    for item in items {
        match item {
            syn::Item::Fn(function) if !test_only(&function.attrs) => {
                if let Some(vis) = visibility(&function.vis) {
                    add(
                        file,
                        namespace,
                        &function.sig,
                        &function.block,
                        vis,
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
                        let vis = visibility(&function.vis).or_else(|| {
                            implementation
                                .trait_
                                .as_ref()
                                .map(|_| "trait-implementation")
                        });
                        if let Some(vis) = vis {
                            add(
                                file,
                                &format!(
                                    "{namespace}::impl@{}",
                                    implementation.span().start().line
                                ),
                                &function.sig,
                                &function.block,
                                vis,
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
