use regex::Regex;

mod regex_cache;
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};

pub const MAX_CUSTOM_SEARCHES: usize = 10;
pub const MAX_CUSTOM_SEARCH_CHARS_PER_RUN: usize = 64_000;
const MAX_MATCHES_PER_SEARCH: usize = 5;
const MAX_VALUE_CHARS: usize = 1_000;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CustomSearchDefinition {
    pub id: String,
    pub name: String,
    pub selector_type: String,
    pub query: String,
    pub result_type: String,
    #[serde(default)]
    pub attribute: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CrawledCustomSearchResult {
    pub id: String,
    pub values: Vec<String>,
    pub error: Option<String>,
    pub truncated: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum XPathTerminal {
    Element,
    Text,
    Attribute(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct XPathSelector {
    css: String,
    terminal: XPathTerminal,
    text_match: Option<XPathTextMatch>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum XPathTextMatch {
    Contains(String),
    ContainsNormalized(String),
    Equals(String),
    EqualsNormalized(String),
}

struct ParsedXPathStep<'a> {
    tag: &'a str,
    css_predicates: Vec<String>,
    text_match: Option<XPathTextMatch>,
}

pub fn validate_custom_searches(searches: &[CustomSearchDefinition]) -> Result<(), String> {
    if searches.len() > MAX_CUSTOM_SEARCHES {
        return Err(format!(
            "Można skonfigurować maksymalnie {MAX_CUSTOM_SEARCHES} wyszukiwań na crawl."
        ));
    }

    let mut ids = std::collections::HashSet::new();
    for search in searches {
        if search.id.trim().is_empty() || !ids.insert(search.id.trim()) {
            return Err("Każde wyszukiwanie musi mieć unikalny identyfikator.".into());
        }
        if search.name.trim().is_empty() || search.name.chars().count() > 80 {
            return Err(
                "Nazwa wyszukiwania jest wymagana i może mieć maksymalnie 80 znaków.".into(),
            );
        }
        if search.query.trim().is_empty() || search.query.chars().count() > 512 {
            return Err(
                "Zapytanie selektora jest wymagane i może mieć maksymalnie 512 znaków.".into(),
            );
        }
        let mode = search.selector_type.trim().to_ascii_lowercase();
        let output = search.result_type.trim().to_ascii_lowercase();
        if !matches!(mode.as_str(), "css" | "xpath" | "regex") {
            return Err(format!(
                "Nieobsługiwany typ selektora: {}.",
                search.selector_type
            ));
        }
        if !matches!(output.as_str(), "text" | "html" | "attribute") {
            return Err(format!(
                "Nieobsługiwany typ wyniku: {}.",
                search.result_type
            ));
        }
        if mode == "regex" {
            if output != "text" {
                return Err(format!(
                    "Wyszukiwanie regex „{}” wymaga typu wyniku Text.",
                    search.name
                ));
            }
            Regex::new(search.query.trim()).map_err(|error| {
                format!("Niepoprawne wyrażenie regex „{}”: {error}.", search.name)
            })?;
            continue;
        }
        if output == "attribute"
            && search
                .attribute
                .as_deref()
                .map_or(true, |attribute| !is_valid_attribute_name(attribute.trim()))
            && mode == "css"
        {
            return Err(format!(
                "Wyszukiwanie „{}” wymaga poprawnej nazwy atrybutu.",
                search.name
            ));
        }
        if mode == "css" {
            Selector::parse(search.query.trim())
                .map_err(|error| format!("Niepoprawny selektor CSS „{}”: {error}.", search.name))?;
        } else {
            let selector = xpath_to_css(search.query.trim())?;
            match selector.terminal {
                XPathTerminal::Text if output != "text" => {
                    return Err(format!(
                        "Wyszukiwanie XPath „{}” kończy się /text() i wymaga typu wyniku Text.",
                        search.name
                    ));
                }
                XPathTerminal::Attribute(_) if output != "attribute" => {
                    return Err(format!(
                        "Wyszukiwanie XPath „{}” kończy się /@atrybut i wymaga typu wyniku Attribute.",
                        search.name
                    ));
                }
                _ => {}
            }
        }
    }
    Ok(())
}

pub fn extract_custom_search_results(
    document: &Html,
    searches: &[CustomSearchDefinition],
) -> Vec<CrawledCustomSearchResult> {
    let mut remaining_chars = MAX_CUSTOM_SEARCH_CHARS_PER_RUN;
    extract_custom_search_results_with_budget(document, searches, &mut remaining_chars)
}

pub fn extract_custom_search_results_with_budget(
    document: &Html,
    searches: &[CustomSearchDefinition],
    remaining_chars: &mut usize,
) -> Vec<CrawledCustomSearchResult> {
    extract_custom_search_results_with_html(document, None, searches, remaining_chars)
}

/// Extract custom searches from a parsed HTML document. Regex searches need
/// the decoded source text because matching serialized DOM would change
/// whitespace/attribute quoting; CSS/XPath searches continue to use the DOM.
pub fn extract_custom_search_results_with_html(
    document: &Html,
    source_html: Option<&str>,
    searches: &[CustomSearchDefinition],
    remaining_chars: &mut usize,
) -> Vec<CrawledCustomSearchResult> {
    searches
        .iter()
        .map(|search| extract_one(document, source_html, search, remaining_chars))
        .collect()
}

fn extract_one(
    document: &Html,
    source_html: Option<&str>,
    search: &CustomSearchDefinition,
    remaining_chars: &mut usize,
) -> CrawledCustomSearchResult {
    let mode = search.selector_type.trim().to_ascii_lowercase();
    let output = search.result_type.trim().to_ascii_lowercase();
    if mode == "regex" {
        let Some(source_html) = source_html else {
            return failed_result(
                search,
                "Wynik regex wymaga źródłowego HTML tego dokumentu.".into(),
            );
        };
        let regex = match regex_cache::cached_regex(search.query.trim()) {
            Ok(regex) => regex,
            Err(error) => {
                return failed_result(search, format!("Nie można wykonać regex: {error}."))
            }
        };
        let mut values = Vec::new();
        let mut truncated = false;
        for captures in regex.captures_iter(source_html) {
            if values.len() == MAX_MATCHES_PER_SEARCH || *remaining_chars == 0 {
                truncated = true;
                break;
            }
            let value = captures
                .get(1)
                .or_else(|| captures.get(0))
                .map(|match_| match_.as_str().to_owned());
            let Some(value) = value.filter(|value| !value.trim().is_empty()) else {
                continue;
            };
            let allowed_chars = MAX_VALUE_CHARS.min(*remaining_chars);
            let value_chars = value.chars().count();
            let bounded = value.chars().take(allowed_chars).collect::<String>();
            let stored_chars = bounded.chars().count();
            *remaining_chars -= stored_chars;
            truncated |= value_chars > stored_chars;
            values.push(bounded);
        }
        return CrawledCustomSearchResult {
            id: search.id.clone(),
            values,
            error: None,
            truncated,
        };
    }
    let xpath_selector = if mode == "xpath" {
        match xpath_to_css(search.query.trim()) {
            Ok(result) => Some(result),
            Err(error) => return failed_result(search, error),
        }
    } else {
        None
    };
    let selector = match Selector::parse(
        xpath_selector
            .as_ref()
            .map(|value| value.css.as_str())
            .unwrap_or_else(|| search.query.trim()),
    ) {
        Ok(selector) => selector,
        Err(error) => {
            return failed_result(search, format!("Nie można wykonać selektora: {error}."))
        }
    };

    let mut values = Vec::new();
    let mut truncated = false;
    for element in document.select(&selector) {
        if *remaining_chars == 0 {
            truncated = true;
            break;
        }
        if let Some(text_match) = xpath_selector
            .as_ref()
            .and_then(|value| value.text_match.as_ref())
        {
            let text = element.text().collect::<String>();
            let normalized = matches!(
                text_match,
                XPathTextMatch::ContainsNormalized(_) | XPathTextMatch::EqualsNormalized(_)
            );
            let candidate = if normalized {
                normalize_xpath_space(&text)
            } else {
                text.trim().to_owned()
            };
            let matches = match text_match {
                XPathTextMatch::Contains(value) | XPathTextMatch::ContainsNormalized(value) => {
                    candidate.contains(value)
                }
                XPathTextMatch::Equals(value) | XPathTextMatch::EqualsNormalized(value) => {
                    candidate == *value
                }
            };
            if !matches {
                continue;
            }
        }
        let value = match (
            xpath_selector.as_ref().map(|value| &value.terminal),
            output.as_str(),
        ) {
            (Some(XPathTerminal::Attribute(attribute)), _) => {
                element.value().attr(attribute).map(str::to_owned)
            }
            (_, "attribute") => search
                .attribute
                .as_deref()
                .and_then(|attribute| element.value().attr(attribute.trim()))
                .map(str::to_owned),
            (_, "html") => Some(element.inner_html()),
            _ => Some(element.text().collect::<String>().trim().to_owned()),
        };
        if let Some(value) = value.filter(|value| !value.trim().is_empty()) {
            if values.len() == MAX_MATCHES_PER_SEARCH {
                truncated = true;
                break;
            }
            let allowed_chars = MAX_VALUE_CHARS.min(*remaining_chars);
            let value_chars = value.chars().count();
            let bounded = value.chars().take(allowed_chars).collect::<String>();
            let stored_chars = bounded.chars().count();
            *remaining_chars -= stored_chars;
            truncated |= value_chars > stored_chars;
            values.push(bounded);
        }
    }

    CrawledCustomSearchResult {
        id: search.id.clone(),
        values,
        error: None,
        truncated,
    }
}

fn failed_result(search: &CustomSearchDefinition, error: String) -> CrawledCustomSearchResult {
    CrawledCustomSearchResult {
        id: search.id.clone(),
        values: Vec::new(),
        error: Some(error),
        truncated: false,
    }
}

fn is_valid_attribute_name(value: &str) -> bool {
    !value.is_empty()
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b':'))
}

/// XPath subset for HTML extraction: absolute/relative element paths, `//` and `/`,
/// attribute presence/equality/contains predicates, positional predicates, and terminal
/// `/text()` or `/@attribute`. Unsupported XPath syntax is an explicit per-search error.
fn xpath_to_css(expression: &str) -> Result<XPathSelector, String> {
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
        let end = rest
            .find(']')
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

enum XPathPredicate {
    Css(String),
    TextMatch(XPathTextMatch),
}

/// Split a boolean XPath predicate at top-level `and` operators. The small
/// parser deliberately ignores operators inside string literals or nested
/// function calls, so values such as `contains(@class, 'brand and sale')`
/// remain a single predicate. We only combine CSS-compatible terms; text
/// predicates still return an explicit unsupported error below.
fn split_xpath_and(predicate: &str) -> Option<Vec<&str>> {
    let bytes = predicate.as_bytes();
    let mut parts = Vec::new();
    let mut start = 0;
    let mut quote = None;
    let mut depth = 0usize;
    let mut index = 0;
    while index < bytes.len() {
        let character = bytes[index] as char;
        if let Some(active_quote) = quote {
            if character == active_quote {
                quote = None;
            }
            index += 1;
            continue;
        }
        if character == '\'' || character == '"' {
            quote = Some(character);
            index += 1;
            continue;
        }
        match character {
            '(' => depth += 1,
            ')' => depth = depth.saturating_sub(1),
            _ => {}
        }
        if depth == 0
            && bytes[index..].starts_with(b"and")
            && (index == 0 || bytes[index - 1].is_ascii_whitespace())
            && (index + 3 == bytes.len() || bytes[index + 3].is_ascii_whitespace())
        {
            parts.push(predicate[start..index].trim());
            start = index + 3;
            index += 3;
            continue;
        }
        index += 1;
    }
    if parts.is_empty() {
        None
    } else {
        parts.push(predicate[start..].trim());
        Some(parts)
    }
}

fn xpath_predicate_to_css(predicate: &str) -> Result<XPathPredicate, String> {
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
    if let Some(literal) = predicate.strip_prefix("text()=") {
        return Ok(XPathPredicate::TextMatch(XPathTextMatch::Equals(
            xpath_literal(literal.trim())?,
        )));
    }
    if let Some(literal) = predicate
        .strip_prefix("normalize-space(.)=")
        .or_else(|| predicate.strip_prefix("normalize-space(text())="))
    {
        return Ok(XPathPredicate::TextMatch(XPathTextMatch::EqualsNormalized(
            xpath_literal(literal.trim())?,
        )));
    }
    Err(format!(
        "Predicate XPath ‘{predicate}’ nie jest obsługiwany."
    ))
}

fn xpath_literal(value: &str) -> Result<String, String> {
    let value = value.trim();
    if value.len() < 2 {
        return Err("Wartość XPath musi być ujęta w apostrofy lub cudzysłowy.".into());
    }
    let quote = value.as_bytes()[0] as char;
    if !matches!(quote, '\'' | '"') || value.as_bytes()[value.len() - 1] as char != quote {
        return Err("Wartość XPath musi być ujęta w apostrofy lub cudzysłowy.".into());
    }
    Ok(value[1..value.len() - 1].to_owned())
}

fn escape_css_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn normalize_xpath_space(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn is_xpath_name_char(character: char) -> bool {
    character.is_ascii_alphanumeric() || matches!(character, '*' | '_' | '-' | ':')
}

#[cfg(test)]
mod tests {
    use super::*;

    fn query(selector_type: &str, query: &str, result_type: &str) -> CustomSearchDefinition {
        CustomSearchDefinition {
            id: "test".into(),
            name: "Test query".into(),
            selector_type: selector_type.into(),
            query: query.into(),
            result_type: result_type.into(),
            attribute: (result_type == "attribute").then(|| "href".into()),
        }
    }

    #[test]
    fn css_search_returns_bounded_text_html_and_attribute_values() {
        let document = Html::parse_document(
            r#"<html><body><a class="product" href="/one"><b> First </b> result</a><a class="product" href="/two">Second</a></body></html>"#,
        );
        let text = extract_custom_search_results(&document, &[query("css", "a.product", "text")]);
        assert_eq!(text[0].values, ["First  result", "Second"]);
        let html = extract_custom_search_results(&document, &[query("css", "a.product", "html")]);
        assert!(html[0].values[0].contains("<b> First </b>"));
        let attr =
            extract_custom_search_results(&document, &[query("css", "a.product", "attribute")]);
        assert_eq!(attr[0].values, ["/one", "/two"]);
    }

    #[test]
    fn xpath_supports_paths_text_attribute_predicates_and_contains() {
        let document = Html::parse_document(
            r#"<html><body><main><a class="product featured" href="/one">Alpha</a><a class="product" href="/two">Beta</a></main></body></html>"#,
        );
        let xpath = query(
            "xpath",
            "//main//a[contains(@class, 'product')]/text()",
            "text",
        );
        let values = extract_custom_search_results(&document, &[xpath]);
        assert_eq!(values[0].values, ["Alpha", "Beta"]);
        let xpath = query(
            "xpath",
            "//main/a[@class='product featured']/@href",
            "attribute",
        );
        let values = extract_custom_search_results(&document, &[xpath]);
        assert_eq!(values[0].values, ["/one"]);

        let xpath = query(
            "xpath",
            "//main/a[normalize-space(text())='Alpha']/text()",
            "text",
        );
        let values = extract_custom_search_results(&document, &[xpath]);
        assert_eq!(values[0].values, ["Alpha"]);
    }

    #[test]
    fn extraction_obeys_the_shared_run_storage_budget() {
        let document =
            Html::parse_document("<html><body><h1>Alpha</h1><h2>Bravo</h2></body></html>");
        let searches = [
            query("css", "h1", "text"),
            CustomSearchDefinition {
                id: "second".into(),
                name: "Second".into(),
                selector_type: "css".into(),
                query: "h2".into(),
                result_type: "text".into(),
                attribute: None,
            },
        ];
        let mut remaining = 3;
        let results =
            extract_custom_search_results_with_budget(&document, &searches, &mut remaining);
        assert_eq!(results[0].values, ["Alp"]);
        assert!(results[0].truncated);
        assert!(results[1].values.is_empty());
        assert!(results[1].truncated);
        assert_eq!(remaining, 0);
    }

    #[test]
    fn xpath_supports_top_level_and_for_css_compatible_predicates() {
        let document = Html::parse_document(
            r#"<html><body><a class="product" data-kind="featured">One</a><a class="product">Two</a><a data-kind="featured">Three</a></body></html>"#,
        );
        let search = query(
            "xpath",
            "//a[@class='product' and @data-kind='featured']/text()",
            "text",
        );
        let values = extract_custom_search_results(&document, &[search]);
        assert_eq!(values[0].values, ["One"]);

        let value_with_and = query(
            "xpath",
            "//a[contains(@class, 'product and featured')]/text()",
            "text",
        );
        let values = extract_custom_search_results(&document, &[value_with_and]);
        assert!(values[0].values.is_empty());
        assert!(values[0].error.is_none());
    }

    #[test]
    fn text_contains_xpath_filters_elements_and_old_configs_default_empty() {
        let document = Html::parse_document(
            r#"<html><body><div>hello world</div><div>goodbye</div><p>Beta</p><p>Alpha</p><span>  Alpha   Beta </span></body></html>"#,
        );
        let xpath = query("xpath", "//div[contains(text(), 'hello')]", "text");
        let values = extract_custom_search_results(&document, &[xpath]);
        assert_eq!(values[0].values, ["hello world"]);
        let xpath = query("xpath", "//p[contains(., 'Bet')]", "text");
        let values = extract_custom_search_results(&document, &[xpath]);
        assert_eq!(values[0].values, ["Beta"]);
        let xpath = query("xpath", "//p[text()='Alpha']", "text");
        let values = extract_custom_search_results(&document, &[xpath]);
        assert_eq!(values[0].values, ["Alpha"]);
        let xpath = query("xpath", "//span[normalize-space(.)='Alpha Beta']", "text");
        let values = extract_custom_search_results(&document, &[xpath]);
        assert_eq!(values[0].values, ["Alpha   Beta"]);
        let xpath = query(
            "xpath",
            "//span[contains(normalize-space(.), 'Alpha Beta')]",
            "text",
        );
        let values = extract_custom_search_results(&document, &[xpath]);
        assert_eq!(values[0].values, ["Alpha   Beta"]);
        let config: serde_json::Value = serde_json::from_str(r#"{"selector_type":"css"}"#).unwrap();
        assert_eq!(config["selector_type"], "css");
    }

    #[test]
    fn xpath_supports_attribute_prefix_absence_and_inequality_predicates() {
        let document = Html::parse_document(
            r#"<html><body>
                <a data-kind="product-1">One</a>
                <a data-kind="service">Two</a>
                <a>Three</a>
                <a data-kind="product-2" data-state="archived">Four</a>
            </body></html>"#,
        );

        let starts_with = query(
            "xpath",
            "//a[starts-with(@data-kind, 'product')]/text()",
            "text",
        );
        let values = extract_custom_search_results(&document, &[starts_with]);
        assert_eq!(values[0].values, ["One", "Four"]);

        let without_state = query("xpath", "//a[not(@data-state)]/text()", "text");
        let values = extract_custom_search_results(&document, &[without_state]);
        assert_eq!(values[0].values, ["One", "Two", "Three"]);

        let not_archived = query("xpath", "//a[@data-kind!='product-2']/text()", "text");
        let values = extract_custom_search_results(&document, &[not_archived]);
        assert_eq!(values[0].values, ["One", "Two"]);
    }

    #[test]
    fn xpath_supports_last_and_position_predicates() {
        let document = Html::parse_document(
            r#"<html><body><ul><li>One</li><li>Two</li><li>Three</li></ul><ul><li>Four</li><li>Five</li></ul></body></html>"#,
        );

        let last = query("xpath", "//ul[1]/li[last()]/text()", "text");
        let values = extract_custom_search_results(&document, &[last]);
        assert_eq!(values[0].values, ["Three"]);

        let position = query("xpath", "//ul[2]/li[position() = 2]/text()", "text");
        let values = extract_custom_search_results(&document, &[position]);
        assert_eq!(values[0].values, ["Five"]);

        let last_position = query("xpath", "//ul[2]/li[position()=last()]/text()", "text");
        let values = extract_custom_search_results(&document, &[last_position]);
        assert_eq!(values[0].values, ["Five"]);
    }

    #[test]
    fn regex_search_uses_first_capture_and_respects_shared_budget() {
        let document = Html::parse_document(
            r#"<html><body><p data-sku="SKU-123">One</p><p data-sku="SKU-456">Two</p></body></html>"#,
        );
        let regex = query("regex", r#"data-sku="([^"]+)""#, "text");
        let mut remaining = 7;
        let values = extract_custom_search_results_with_html(
            &document,
            Some(r#"<p data-sku="SKU-123"></p><p data-sku="SKU-456"></p>"#),
            &[regex],
            &mut remaining,
        );
        assert_eq!(values[0].values, ["SKU-123"]);
        assert!(values[0].truncated);
        assert_eq!(remaining, 0);
    }

    #[test]
    fn regex_search_rejects_invalid_patterns_and_non_text_output() {
        let invalid = query("regex", "[", "text");
        assert!(validate_custom_searches(&[invalid]).is_err());
        let attribute = query("regex", "sku", "attribute");
        assert!(validate_custom_searches(&[attribute]).is_err());
    }
}
