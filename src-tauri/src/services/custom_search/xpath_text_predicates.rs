use super::models::{XPathPredicate, XPathTextMatch};
use super::xpath_predicate_helpers::xpath_literal;

pub fn parse_text_predicate(predicate: &str) -> Option<Result<XPathPredicate, String>> {
    if let Some(literal) = predicate.strip_prefix("text()=") {
        return Some(
            xpath_literal(literal.trim())
                .map(|lit| XPathPredicate::TextMatch(XPathTextMatch::Equals(lit))),
        );
    }
    if let Some(literal) = predicate
        .strip_prefix("normalize-space(.)=")
        .or_else(|| predicate.strip_prefix("normalize-space(text())="))
    {
        return Some(
            xpath_literal(literal.trim())
                .map(|lit| XPathPredicate::TextMatch(XPathTextMatch::EqualsNormalized(lit))),
        );
    }
    None
}
