use super::models::{ParsedXPathStep, XPathPredicate, XPathSelector, XPathTerminal};
use super::validation::is_valid_attribute_name;
use super::xpath_predicate_helpers::{is_xpath_name_char, xpath_predicate_end};
use super::xpath_predicates::xpath_predicate_to_css;
use scraper::Selector;

/// XPath subset for HTML extraction: absolute/relative element paths, `//` and `/`,
/// attribute presence/equality/contains predicates, positional predicates, and terminal
/// `/text()` or `/@attribute`. Unsupported XPath syntax is an explicit per-search error.
pub fn xpath_to_css(expression: &str) -> Result<XPathSelector, String> {
    let mut path = expression.trim();
    let mut terminal = XPathTerminal::Element;
    if let Some(stripped) = path.strip_suffix("/text()") {
        path = stripped;
        terminal = XPathTerminal::Text;
    } else if let Some(index) = path.rfind("/@") {
        let attribute = &path[index + 2..];
        if !is_valid_attribute_name(attribute) {
            return Err("XPath ma niepoprawny atrybut końcowy po /@.".into());
        }
        path = &path[..index];
        terminal = XPathTerminal::Attribute(attribute.to_owned());
    }

    if path.is_empty() || !path.starts_with('/') && !path.starts_with('.') {
        return Err("XPath musi zaczynać się od /, // lub .".into());
    }

    let bytes = path.as_bytes();
    let mut index = 0;
    let mut descendant = false;
    let mut steps: Vec<(String, bool)> = Vec::new();
    while index < bytes.len() {
        if bytes[index] == b'.' && steps.is_empty() {
            index += 1;
            continue;
        }
        if bytes[index] == b'/' {
            descendant = index + 1 < bytes.len() && bytes[index + 1] == b'/';
            index += if descendant { 2 } else { 1 };
            continue;
        }
        let start = index;
        let mut depth = 0usize;
        let mut quote = None;
        while index < bytes.len() {
            let character = bytes[index] as char;
            if let Some(active_quote) = quote {
                if character == active_quote {
                    quote = None;
                }
            } else if character == '\'' || character == '"' {
                quote = Some(character);
            } else if character == '[' {
                depth += 1;
            } else if character == ']' {
                depth = depth.saturating_sub(1);
            } else if character == '/' && depth == 0 {
                break;
            }
            index += 1;
        }
        let step = path[start..index].trim();
        if step.is_empty() || step.starts_with('@') || step == "text()" {
            return Err(format!("XPath step ‘{step}’ nie jest obsługiwany."));
        }
        steps.push((step.to_owned(), descendant));
        descendant = false;
    }
    if steps.is_empty() {
        return Err("XPath nie wskazuje elementu HTML.".into());
    }

    let mut css = String::new();
    let mut text_match = None;
    for (position, (step, is_descendant)) in steps.iter().enumerate() {
        let parsed = parse_xpath_step(step)?;
        if let Some(predicate) = parsed.text_match {
            if text_match.is_some() {
                return Err("XPath może zawierać najwyżej jeden predicate tekstowy.".into());
            }
            text_match = Some(predicate);
        }
        if position > 0 {
            css.push_str(if *is_descendant { " " } else { " > " });
        }
        css.push_str(parsed.tag);
        for predicate in parsed.css_predicates {
            css.push_str(&predicate);
        }
    }
    Selector::parse(&css)
        .map_err(|error| format!("XPath nie może być przetłumaczony: {error}."))?;
    Ok(XPathSelector {
        css,
        terminal,
        text_match,
    })
}

fn parse_xpath_step(step: &str) -> Result<ParsedXPathStep<'_>, String> {
    let Some(open) = step.find('[') else {
        if step.chars().all(is_xpath_name_char) {
            return Ok(ParsedXPathStep {
                tag: step,
                css_predicates: Vec::new(),
                text_match: None,
            });
        }
        return Err(format!("Nieobsługiwana składnia XPath ‘{step}’."));
    };
    let tag = step[..open].trim();
    if tag.is_empty() || !tag.chars().all(is_xpath_name_char) {
        return Err(format!("Niepoprawny element XPath ‘{tag}’."));
    }
    let mut predicates = Vec::new();
    let mut text_match = None;
    let mut remaining = &step[open..];
    while !remaining.is_empty() {
        let Some(rest) = remaining.strip_prefix('[') else {
            return Err(format!("Niepoprawny predicate XPath ‘{step}’."));
        };
        let end = xpath_predicate_end(rest)
            .ok_or_else(|| format!("Niezamknięty predicate XPath ‘{step}’."))?;
        let predicate = rest[..end].trim();
        match xpath_predicate_to_css(predicate)? {
            XPathPredicate::Css(css) => predicates.push(css),
            XPathPredicate::TextMatch(value) => {
                if text_match.is_some() {
                    return Err(format!(
                        "XPath step ‘{step}’ ma więcej niż jeden predicate tekstowy."
                    ));
                }
                text_match = Some(value);
            }
        }
        remaining = &rest[end + 1..];
    }
    Ok(ParsedXPathStep {
        tag,
        css_predicates: predicates,
        text_match,
    })
}
