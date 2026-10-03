use serde::Serialize;
use syn::spanned::Spanned;

#[derive(Debug, Serialize)]
pub(crate) struct Function {
    pub(crate) file: String,
    pub(crate) name: String,
    pub(crate) namespace: String,
    pub(crate) visibility: String,
    pub(crate) line: usize,
    pub(crate) body_line: usize,
    pub(crate) end_line: usize,
    pub(crate) conditional: bool,
}

pub(crate) fn test_only(attributes: &[syn::Attribute]) -> bool {
    attributes.iter().any(|attribute| {
        attribute.path().is_ident("test")
            || (attribute.path().is_ident("cfg")
                && attribute
                    .meta
                    .require_list()
                    .is_ok_and(|list| list.tokens.to_string() == "test"))
    })
}

pub(crate) fn visibility(value: &syn::Visibility) -> Option<&'static str> {
    match value {
        syn::Visibility::Public(_) => Some("declared-public"),
        syn::Visibility::Restricted(_) => Some("restricted"),
        syn::Visibility::Inherited => None,
    }
}

pub(crate) fn add(
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
