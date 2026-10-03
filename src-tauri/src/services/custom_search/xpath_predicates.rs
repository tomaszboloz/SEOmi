use super::models::{XPathPredicate, XPathTextMatch};
use super::validation::is_valid_attribute_name;
use super::xpath_predicate_helpers::{escape_css_string, split_xpath_and, xpath_literal};
use super::xpath_text_predicates::parse_text_predicate;

pub fn xpath_predicate_to_css(predicate: &str) -> Result<XPathPredicate, String> {
    if let Some(parts) = split_xpath_and(predicate) {
        let mut css = String::new();
        for part in parts {
            if part.is_empty() {
                return Err("XPath predicate `and` ma pusty operand.".into());
            }
            match xpath_predicate_to_css(part)? {
                XPathPredicate::Css(value) => css.push_str(&value),
                XPathPredicate::TextMatch(_) => {
                    return Err(
                        "XPath łączy predykaty tekstowe przez `and`, co nie jest obsługiwane."
                            .into(),
                    )
                }
            }
        }
        return Ok(XPathPredicate::Css(css));
    }
    let normalized = predicate.split_whitespace().collect::<String>();
    if normalized == "last()" {
        return Ok(XPathPredicate::Css(":last-of-type".into()));
    }
    if let Some((left, right)) = predicate.split_once('=') {
        if left.trim() == "position()" {
            let position = right.trim();
            if position == "last()" {
                return Ok(XPathPredicate::Css(":last-of-type".into()));
            }
            let position = position
                .parse::<usize>()
                .map_err(|_| "Pozycje XPath są liczone od 1.".to_owned())?;
            return if position > 0 {
                Ok(XPathPredicate::Css(format!(":nth-of-type({position})")))
            } else {
                Err("Pozycje XPath są liczone od 1.".into())
            };
        }
    }
    if let Ok(position) = predicate.parse::<usize>() {
        return if position > 0 {
            Ok(XPathPredicate::Css(format!(":nth-of-type({position})")))
        } else {
            Err("Pozycje XPath są liczone od 1.".into())
        };
    }
    if let Some(attribute) = predicate.strip_prefix('@') {
        if let Some((name, value)) = attribute.split_once("!=") {
            let name = name.trim();
            let value = xpath_literal(value.trim())?;
            if !is_valid_attribute_name(name) {
                return Err(format!("Niepoprawna nazwa atrybutu XPath ‘{name}’."));
            }
            return Ok(XPathPredicate::Css(format!(
                "[{name}]:not([{name}=\"{}\"])",
                escape_css_string(&value)
            )));
        }
        if let Some((name, value)) = attribute.split_once('=') {
            let name = name.trim();
            let value = xpath_literal(value.trim())?;
            if !is_valid_attribute_name(name) {
                return Err(format!("Niepoprawna nazwa atrybutu XPath ‘{name}’."));
            }
            return Ok(XPathPredicate::Css(format!(
                "[{name}=\"{}\"]",
                escape_css_string(&value)
            )));
        }
        if !is_valid_attribute_name(attribute.trim()) {
            return Err(format!("Niepoprawna nazwa atrybutu XPath ‘{attribute}’."));
        }
        return Ok(XPathPredicate::Css(format!("[{}]", attribute.trim())));
    }
    if let Some(arguments) = predicate
        .strip_prefix("starts-with(")
        .and_then(|value| value.strip_suffix(')'))
    {
        let (first_argument, literal) = arguments
            .split_once(',')
            .ok_or_else(|| format!("Niepoprawne XPath starts-with({arguments})."))?;
        let attribute = first_argument.trim().strip_prefix('@').ok_or_else(|| {
            "XPath starts-with() obsługuje wyłącznie atrybut jako pierwszy argument.".to_owned()
        })?;
        if !is_valid_attribute_name(attribute) {
            return Err(format!("Niepoprawna nazwa atrybutu XPath ‘{attribute}’."));
        }
        let literal = xpath_literal(literal.trim())?;
        return Ok(XPathPredicate::Css(format!(
            "[{attribute}^=\"{}\"]",
            escape_css_string(&literal)
        )));
    }
    if let Some(inner) = predicate
        .strip_prefix("not(")
        .and_then(|value| value.strip_suffix(')'))
    {
        let inner = inner.trim();
        if let Some(attribute) = inner.strip_prefix('@') {
            if !is_valid_attribute_name(attribute) {
                return Err(format!("Niepoprawna nazwa atrybutu XPath ‘{attribute}’."));
            }
            return Ok(XPathPredicate::Css(format!(":not([{attribute}])")));
        }
        return Err("XPath not() obsługuje wyłącznie test obecności atrybutu.".into());
    }
    if let Some(arguments) = predicate
        .strip_prefix("contains(")
        .and_then(|value| value.strip_suffix(')'))
    {
        let (first_argument, literal) = arguments
            .split_once(',')
            .ok_or_else(|| format!("Niepoprawne XPath contains({arguments})."))?;
        let literal = xpath_literal(literal.trim())?;
        if let Some(attribute) = first_argument.trim().strip_prefix('@') {
            if !is_valid_attribute_name(attribute) {
                return Err(format!("Niepoprawna nazwa atrybutu XPath ‘{attribute}’."));
            }
            return Ok(XPathPredicate::Css(format!(
                "[{attribute}*=\"{}\"]",
                escape_css_string(&literal)
            )));
        }
        return match first_argument.trim() {
            "text()" | "." => Ok(XPathPredicate::TextMatch(XPathTextMatch::Contains(literal))),
            "normalize-space(.)" | "normalize-space(text())" => Ok(XPathPredicate::TextMatch(
                XPathTextMatch::ContainsNormalized(literal),
            )),
            _ => Err("XPath contains() obsługuje @name, text(), . albo normalize-space(.).".into()),
        };
    }
    if let Some(result) = parse_text_predicate(predicate) {
        return result;
    }
    Err(format!(
        "Predicate XPath ‘{predicate}’ nie jest obsługiwany."
    ))
}
